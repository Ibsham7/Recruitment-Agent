import asyncio
import os
import contextlib
from urllib.parse import urlparse, urlunparse
from typing import Any, cast
from psycopg import AsyncConnection
from psycopg.rows import dict_row
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from app.database import prisma
from prisma import Json
from .graph import build_recruitment_graph
from app.dev_logger import log_event, log_error
from app.agent.state import RecruitmentState

@contextlib.asynccontextmanager
async def get_checkpointer(cp=None):
    if cp:
        yield cp
    else:
        from app.database import get_global_checkpointer, get_db_url
        global_cp = get_global_checkpointer()
        if global_cp:
            yield global_cp
        else:
            db_url = get_db_url()
            if db_url:
                async with await AsyncConnection.connect(
                    db_url, autocommit=True, prepare_threshold=None, row_factory=dict_row
                ) as conn:
                    new_cp = AsyncPostgresSaver(conn)
                    await new_cp.setup()
                    yield new_cp
            else:
                yield None

def _build_evaluation_from_screening(res, strictness: str = "moderate"):
    from app.agent.schemas import EvaluationReport
    
    # 1. Matched strengths (filter out skills_list_only, inferred, absent)
    matched = []
    valid_strength_types = {"employment", "project", "education"}
    for req in res.must_have:
        ev_type = getattr(req, "evidence_type", "employment")
        if req.match == "full" and ev_type in valid_strength_types:
            matched.append(f"{req.requirement}" + (f" ({req.evidence})" if req.evidence else ""))
    for req in res.nice_to_have:
        ev_type = getattr(req, "evidence_type", "employment")
        if req.match != "none" and ev_type in valid_strength_types:
            matched.append(f"{req.requirement}" + (f" ({req.evidence})" if req.evidence else ""))
            
    # 2. Detailed Concerns with severity tags
    concerns = []
    # Must-have missing
    for req in res.must_have:
        if req.match == "none":
            concerns.append(f"[CRITICAL GAP] Missing Must-Have: {req.requirement}" + (f" ({req.evidence})" if req.evidence else ""))
            
    # Must-have partial
    for req in res.must_have:
        if req.match == "partial":
            concerns.append(f"[MODERATE GAP] Partial Skill Match: {req.requirement}" + (f" - {req.evidence}" if req.evidence else ""))
            
    # Experience / Tenure shortfall
    sb = getattr(res, "score_breakdown", None)
    exp_assess = getattr(res, "experience_assessment", "") or ""
    if sb and getattr(sb, "experience_score", 100) < 70:
        gap_msg = f"[TENURE GAP] Experience Shortfall (Score {sb.experience_score}/100)"
        if exp_assess:
            gap_msg += f": {exp_assess}"
        concerns.append(gap_msg)
    elif exp_assess and any(kw in exp_assess.lower() for kw in ["shortfall", "intern", "less than", "duration"]):
        concerns.append(f"[TENURE GAP] Experience Note: {exp_assess}")
        
    # Nice-to-have missing
    for req in res.nice_to_have:
        if req.match == "none":
            concerns.append(f"[MINOR GAP] Preferred Requirement Missing: {req.requirement}")
            
    if not concerns:
        concerns = ["No major critical concerns flagged."]
        
    # 3. Recommendation Calibration aligning with Lenient/Moderate/Strict thresholds
    decision = getattr(res, "decision", None)
    fit_score = getattr(res, "fit_score", None)
    if decision is None and fit_score is not None:
        if fit_score >= 75:
            decision = "advance"
        elif fit_score >= 50:
            decision = "hold"
        else:
            decision = "reject"
    rec = decision or "hold"
    if decision == "advance":
        if fit_score is not None and fit_score >= 75:
            rec = "shortlist"
        else:
            rec = "hold"
    elif decision == "hold":
        rec = "hold"
    else:
        rec = "reject"
        
    cot_parts = []
    exp_assessment = getattr(res, "experience_assessment", "") or ""
    score_breakdown = getattr(res, "score_breakdown", None)
    reasoning_summary = getattr(res, "reasoning_summary", "") or ""
    fit_score_val = getattr(res, "fit_score", None)

    if exp_assessment:
        cot_parts.append(f"Experience Assessment: {exp_assessment}")
    if score_breakdown:
        cot_parts.append(
            f"Score Attribution:\n"
            f"• Required Skills (50%): {getattr(score_breakdown, 'required_skills_score', 'N/A')}/100\n"
            f"• Experience Depth (25%): {getattr(score_breakdown, 'experience_score', 'N/A')}/100\n"
            f"• Nice-to-Have Skills (15%): {getattr(score_breakdown, 'nice_to_have_score', 'N/A')}/100\n"
            f"• Trajectory & Growth (10%): {getattr(score_breakdown, 'trajectory_score', 'N/A')}/100\n"
            f"Overall Fit Score: {fit_score_val}/100"
        )
    if reasoning_summary:
        cot_parts.append(f"Decision Summary: {reasoning_summary}")
        
    summary_text = reasoning_summary.strip() if reasoning_summary.strip() else ""
    if not summary_text:
        matched_str = f"Satisfies key requirements: {', '.join([req.requirement for req in res.must_have if req.match == 'full'][:3])}." if matched else "Evaluated against job description requirements."
        summary_text = f"Candidate evaluated with a Fit Score of {fit_score_val}/100 ({rec.title()}). {matched_str}"

    return EvaluationReport(
        overall_score=float(fit_score_val or 0.0),
        communication_score=0.0,
        technical_score=0.0,
        cultural_fit_score=0.0,
        strengths=matched if matched else ["Strong foundational qualifications"],
        concerns=concerns,
        score_breakdown=score_breakdown,
        recommendation=rec,
        summary=summary_text,
        chain_of_thought="\n\n".join(cot_parts)
    )

async def start_candidate_pipeline(candidate_id: str, cv_url: str, jd_text: str, checkpointer=None):
    # Load existing profile if it's cached
    candidate = await prisma.candidate.find_unique(where={"id": candidate_id}, include={"campaign": True, "resume": True})
    candidate_profile = None
    hard_filters_config = []
    enable_interviews = True
    interview_config = None
    evaluation_strictness = "moderate"
    if candidate:
        if candidate.resume and candidate.resume.structuredProfile:
            import json
            from app.agent.schemas import CandidateProfile
            profile_data = candidate.resume.structuredProfile
            if isinstance(profile_data, str):
                profile_data = json.loads(profile_data)
            candidate_profile = CandidateProfile(**profile_data)
            
        if candidate.campaign:
            if candidate.campaign.hardFiltersConfig:
                import json
                config_data = candidate.campaign.hardFiltersConfig
                if isinstance(config_data, str):
                    config_data = json.loads(config_data)
                hard_filters_config = config_data
            if hasattr(candidate.campaign, "enableInterviews"):
                enable_interviews = candidate.campaign.enableInterviews
            if hasattr(candidate.campaign, "interviewConfig"):
                interview_config = candidate.campaign.interviewConfig
            if hasattr(candidate.campaign, "evaluationStrictness"):
                evaluation_strictness = candidate.campaign.evaluationStrictness
            
    async with get_checkpointer(checkpointer) as active_checkpointer:
        graph = build_recruitment_graph(checkpointer=active_checkpointer)
        config = {"configurable": {"thread_id": candidate_id}}
        
        initial_state = {
            "cv_filepath": cv_url,
            "job_description": jd_text,
            "candidate_id": candidate_id,
            "candidate_profile": candidate_profile,
            "hard_filters_config": hard_filters_config,
            "penalties": [],
            "enable_interviews": enable_interviews,
            "interview_config": interview_config,
            "jd_matcher_prompt_variant": evaluation_strictness,
            "screening_result": None,
            "interview_questions": [],
            "interview_transcript": None,
            "evaluation_report": None,
            "pipeline_status": "running",
            "rejection_reason": None,
            "log": [],
            "human_decision": None,
            "human_notes": None,
        }
    
        current_state = await graph.aget_state(config)
        input_state = initial_state if getattr(current_state, "values", {}) == {} else None
    
        interrupt_value = None
        final_state = None
        try:
            log_event(candidate_id, "GRAPH", f"Starting graph execution for candidate {candidate_id}")
            events = graph.astream(cast(Any, input_state), config=config, stream_mode="updates")
            async for event in events:
                for node_name, node_output in event.items():
                    if isinstance(node_output, dict) and "log" in node_output:
                        for log_msg in node_output.get("log", []):
                            log_event(candidate_id, node_name, log_msg)
                    if node_name == "__interrupt__":
                        interrupt_value = node_output[0].value
                        log_event(candidate_id, "GRAPH", f"Graph paused at interrupt: {interrupt_value}")
            
            final_state_res = await graph.aget_state(config)
            final_state = final_state_res.values
        except Exception as e:
            log_error(candidate_id, "start_candidate_pipeline", e)
            await prisma.candidate.update(
                where={"id": candidate_id},
                data={
                    "status": "screening",
                    "rejectionReason": None
                }
            )
            
    if final_state:
        if final_state.get("pipeline_status") == "rejected":
            status = "rejected"
        elif interrupt_value == "hold_for_review":
            status = "screening_hold"
        elif final_state.get("pipeline_status") == "shortlisted":
            status = "shortlisted"
        else:
            status = final_state.get("pipeline_status", "shortlisted")
        
        log_event(candidate_id, "GRAPH", f"Candidate graph execution finished (status={status})")
        update_data = {"status": status}
            
        if final_state.get("rejection_reason"):
            update_data["rejectionReason"] = final_state["rejection_reason"]
            
        if final_state.get("screening_result") and status != "rejected" and final_state.get("pipeline_status") != "rejected":
            base_score = final_state["screening_result"].fit_score
            update_data["fitScore"] = min(100.0, max(0.0, float(base_score))) if base_score is not None else None
        else:
            update_data["fitScore"] = None
            
        if final_state.get("candidate_profile"):
            profile = final_state["candidate_profile"]
            if hasattr(profile, "model_dump"):
                profile_dict = profile.model_dump()
            else:
                profile_dict = profile

            profile_update = {
                "name": profile_dict.get("name"),
                "email": profile_dict.get("email"),
                "phone": profile_dict.get("phone"),
                "skills": profile_dict.get("skills", []),
                "education": profile_dict.get("education", []),
            }
            update_data.update({k: v for k, v in profile_update.items() if v is not None})
            
        if final_state.get("total_cost") is not None:
            update_data["apiCost"] = round(float(final_state.get("total_cost", 0.0)), 6)
        if final_state.get("stage_costs"):
            update_data["costBreakdown"] = Json(final_state["stage_costs"])
            
        await prisma.candidate.update(where={"id": candidate_id}, data=update_data)

        
        # Save evaluation report if available
        evaluation_report = final_state.get("evaluation_report")
        
        # Auto-generate evaluation for candidate if missing after JD screening
        if not evaluation_report and final_state.get("screening_result"):
            res = final_state["screening_result"]
            evaluation_report = _build_evaluation_from_screening(res, evaluation_strictness)
        elif not evaluation_report and status == "rejected" and final_state.get("rejection_reason"):
            from app.agent.schemas import EvaluationReport
            evaluation_report = EvaluationReport(
                overall_score=0.0,
                communication_score=0.0,
                technical_score=0.0,
                cultural_fit_score=0.0,
                strengths=[],
                concerns=["Candidate was rejected prior to interview."],
                recommendation="reject",
                summary=final_state["rejection_reason"]
            )
            
        if evaluation_report:
            existing_eval = await prisma.evaluation.find_unique(where={"candidateId": candidate_id})
            eval_data = {
                "overallScore": evaluation_report.overall_score,
                "technicalScore": evaluation_report.technical_score,
                "communicationScore": evaluation_report.communication_score,
                "culturalFitScore": evaluation_report.cultural_fit_score,
                "recommendation": evaluation_report.recommendation,
                "summary": evaluation_report.summary,
                "strengths": evaluation_report.strengths,
                "concerns": evaluation_report.concerns,
                "chainOfThought": evaluation_report.chain_of_thought,
            }
            if evaluation_report.score_breakdown:
                eval_data["scoreBreakdown"] = Json(evaluation_report.score_breakdown.dict())
            if final_state.get("interview_questions"):
                eval_data["interviewQuestions"] = Json([q.dict() for q in final_state["interview_questions"]])
                
            if not existing_eval:
                eval_data["candidate"] = {"connect": {"id": candidate_id}}
                await prisma.evaluation.create(data=eval_data)
            else:
                await prisma.evaluation.update(where={"candidateId": candidate_id}, data=eval_data)
    elif interrupt_value:
        # Fallback if no final_state but interrupted
        fallback_status = "screening_hold" if interrupt_value == "hold_for_review" else "shortlisted"
        await prisma.candidate.update(
            where={"id": candidate_id},
            data={"status": fallback_status}
        )
async def _run_evaluator_background(candidate_id: str, candidate: Any, transcript_list: list):
    try:
        import json
        from app.agent.schemas import (
            CandidateProfile, ScreeningResult, ScoreBreakdown,
            InterviewTranscript, InterviewQuestion, normalize_telemetry
        )

        # 1. Aggregate cumulative anti-cheat telemetry across candidate turns
        total_blur = 0
        total_focus = 0.0
        total_paste_cnt = 0
        total_pasted_ch = 0
        total_ans_ch = 0
        all_timestamps = []
        all_flags = []

        for turn in transcript_list:
            if isinstance(turn, dict) and turn.get("role") == "candidate":
                t_telemetry = turn.get("telemetry") or {}
                if isinstance(t_telemetry, dict):
                    total_blur += int(t_telemetry.get("blur_count") or t_telemetry.get("blurCount") or 0)
                    total_focus += float(t_telemetry.get("focus_duration_seconds") or t_telemetry.get("focusDuration") or t_telemetry.get("focus_duration") or 0.0)
                    total_paste_cnt += int(t_telemetry.get("paste_count") or t_telemetry.get("pasteCount") or 0)
                    total_pasted_ch += int(t_telemetry.get("total_pasted_chars") or t_telemetry.get("totalPastedChars") or 0)
                    
                    ans_len = len(turn.get("message", ""))
                    t_ans_ch = int(t_telemetry.get("total_answer_chars") or t_telemetry.get("totalAnswerChars") or ans_len)
                    total_ans_ch += t_ans_ch
                    
                    ts = t_telemetry.get("paste_timestamps") or t_telemetry.get("pasteTimestamps") or []
                    if isinstance(ts, list):
                        all_timestamps.extend(ts)
                        
                    fl = t_telemetry.get("flags") or []
                    if isinstance(fl, list):
                        all_flags.extend(fl)

        cum_paste_ratio = round(total_pasted_ch / total_ans_ch, 4) if total_ans_ch > 0 else 0.0
        cumulative_anti_cheat_metadata = {
            "blur_count": total_blur,
            "blurCount": total_blur,
            "focus_duration_seconds": total_focus,
            "focusDuration": total_focus,
            "paste_count": total_paste_cnt,
            "pasteCount": total_paste_cnt,
            "total_pasted_chars": total_pasted_ch,
            "totalPastedChars": total_pasted_ch,
            "total_answer_chars": total_ans_ch,
            "totalAnswerChars": total_ans_ch,
            "paste_ratio": cum_paste_ratio,
            "pasteRatio": cum_paste_ratio,
            "paste_timestamps": all_timestamps,
            "pasteTimestamps": all_timestamps,
            "flags": list(dict.fromkeys([str(f) for f in all_flags if f]))
        }

        profile_data = candidate.resume.structuredProfile if (candidate.resume and candidate.resume.structuredProfile) else {}
        if isinstance(profile_data, str):
            profile_data = json.loads(profile_data)
        if not isinstance(profile_data, dict):
            profile_data = {}
        if "name" not in profile_data:
            profile_data["name"] = candidate.name or "Candidate"
        if "total_experience_years" not in profile_data:
            profile_data["total_experience_years"] = 0.0

        candidate_profile = CandidateProfile(**profile_data)

        fit_score_val = int(round(candidate.fitScore)) if candidate.fitScore is not None else 0
        screening_result = ScreeningResult(
            fit_score=fit_score_val,
            score_breakdown=ScoreBreakdown(
                required_skills_score=fit_score_val,
                experience_score=fit_score_val,
                nice_to_have_score=fit_score_val,
                trajectory_score=fit_score_val,
            ),
            must_have=[],
            nice_to_have=[],
            experience_assessment=candidate.evaluation.summary if candidate.evaluation else "",
            reasoning_summary=candidate.evaluation.summary if candidate.evaluation else "",
            decision="advance"
        )

        questions_asked = []
        answers_given = []
        temp_q = None
        for turn in transcript_list:
            if turn.get("role") in ["ai", "interviewer"]:
                temp_q = turn.get("message", "")
            elif turn.get("role") == "candidate" and temp_q:
                questions_asked.append(InterviewQuestion(question=temp_q, category="Technical", what_to_look_for="Relevance and technical depth"))
                answers_given.append(turn.get("message", ""))
                temp_q = None

        it_obj = InterviewTranscript(
            questions_asked=questions_asked,
            answers_given=answers_given,
            current_question_index=len(questions_asked)
        )
        setattr(it_obj, "anti_cheat_telemetry", cumulative_anti_cheat_metadata)

        eval_state = {
            "candidate_profile": candidate_profile,
            "screening_result": screening_result,
            "job_description": candidate.campaign.jobDescription if candidate.campaign else "",
            "interview_transcript": it_obj,
            "anti_cheat_telemetry": cumulative_anti_cheat_metadata,
            "raw_interview_transcript": transcript_list,
            "jd_matcher_prompt_variant": candidate.campaign.evaluationStrictness if candidate.campaign else "moderate"
        }

        from app.agent.nodes.evaluator import evaluator_node
        eval_res = await evaluator_node(eval_state)
        report = eval_res.get("evaluation_report")

        if report:
            ai_likelihood_score = float(report.ai_generated_likelihood_score or 0.0)
            flags_json = report.anti_cheat_flags if isinstance(report.anti_cheat_flags, list) else []

            # Synthesize evaluator flags with cumulative flags in metadata
            rep_flag_strings = []
            for f in flags_json:
                if isinstance(f, dict):
                    rep_flag_strings.append(f.get("flag") or str(f))
                elif isinstance(f, str):
                    rep_flag_strings.append(f)
            merged_flags = list(dict.fromkeys(cumulative_anti_cheat_metadata.get("flags", []) + rep_flag_strings))
            cumulative_anti_cheat_metadata["flags"] = merged_flags

            await prisma.evaluation.update(
                where={"candidateId": candidate_id},
                data={
                    "overallScore": report.overall_score,
                    "technicalScore": report.technical_score,
                    "communicationScore": report.communication_score,
                    "culturalFitScore": report.cultural_fit_score,
                    "recommendation": report.recommendation,
                    "summary": report.summary,
                    "strengths": report.strengths,
                    "concerns": report.concerns,
                    "chainOfThought": report.chain_of_thought,
                    "aiGeneratedLikelihoodScore": ai_likelihood_score,
                    "antiCheatFlags": Json(flags_json),
                    "antiCheatMetadata": Json(cumulative_anti_cheat_metadata)
                }
            )
            current_breakdown = candidate.costBreakdown or {}
            if isinstance(current_breakdown, str):
                import json
                current_breakdown = json.loads(current_breakdown)
            stage_costs = eval_res.get("stage_costs") or {}
            from app.agent.state import merge_dicts
            updated_breakdown = merge_dicts(current_breakdown, stage_costs)

            await prisma.candidate.update(
                where={"id": candidate_id},
                data={
                    "status": "review",
                    "apiCost": round(candidate.apiCost + eval_res.get("total_cost", 0.0), 6),
                    "costBreakdown": Json(updated_breakdown)
                }
            )

    except Exception as e:
        print(f"[Interview] Evaluator background task failed for {candidate_id}: {e}")

async def process_interview_answer(candidate_id: str, answer_text: str, telemetry: Any = None):
    """
    Processes candidate answer submission for an active interview session.
    Updates interview transcript with embedded turn anti-cheat telemetry,
    calculates cumulative antiCheatMetadata, handles non-blocking adaptive probing,
    and advances or completes assessment when all questions are answered.
    """
    candidate = await prisma.candidate.find_unique(
        where={"id": candidate_id},
        include={"campaign": True, "resume": True, "evaluation": True}
    )
    if not candidate or not candidate.evaluation:
        print(f"[Interview] Candidate {candidate_id} or evaluation not found")
        return

    if candidate.status == "interview_completed":
        print(f"[Interview] Candidate {candidate_id} has already completed interview")
        return

    import json
    from datetime import datetime
    from app.agent.schemas import normalize_telemetry

    now_str = datetime.now().strftime("%I:%M %p")

    raw_questions = candidate.evaluation.interviewQuestions or []
    if isinstance(raw_questions, str):
        raw_questions = json.loads(raw_questions)
    if not isinstance(raw_questions, list):
        raw_questions = []

    raw_transcript = candidate.evaluation.interviewTranscript or []
    if isinstance(raw_transcript, str):
        raw_transcript = json.loads(raw_transcript)
    transcript_list = list(raw_transcript)

    # 1. Count candidate responses so far
    cand_turns = [t for t in transcript_list if isinstance(t, dict) and t.get("role") == "candidate"]
    curr_ans_idx = len(cand_turns)  # Index of question currently being answered

    # Get question text being answered
    q_obj = raw_questions[curr_ans_idx] if curr_ans_idx < len(raw_questions) else (raw_questions[-1] if raw_questions else {})
    q_text = q_obj.get("question") if isinstance(q_obj, dict) else str(q_obj)

    # Ensure initial AI question is in transcript if transcript was completely empty
    if len(transcript_list) == 0 and len(raw_questions) > 0:
        first_q = raw_questions[0]
        q1_text = first_q.get("question") if isinstance(first_q, dict) else str(first_q)
        transcript_list.append({"role": "ai", "message": q1_text, "time": now_str})

    # Normalize turn telemetry and ensure answer character metrics are recorded
    telemetry_dict = normalize_telemetry(telemetry)
    ans_len = len(answer_text)
    if telemetry_dict.get("total_answer_chars", 0) == 0:
        telemetry_dict["total_answer_chars"] = ans_len
        telemetry_dict["totalAnswerChars"] = ans_len
        if telemetry_dict.get("total_pasted_chars", 0) > 0 and ans_len > 0:
            calc_ratio = round(telemetry_dict["total_pasted_chars"] / ans_len, 4)
            telemetry_dict["paste_ratio"] = calc_ratio
            telemetry_dict["pasteRatio"] = calc_ratio

    # Record candidate answer turn containing embedded turn telemetry
    transcript_list.append({
        "role": "candidate",
        "message": answer_text,
        "time": now_str,
        "telemetry": telemetry_dict
    })

    # Check for adaptive probing: if answer is short (< 20 words) and probe not generated yet for this interview
    words = answer_text.strip().split()
    probe_already_exists = any(
        isinstance(q, dict) and str(q.get("question", "")).startswith("[Follow-up]")
        for q in raw_questions
    )

    probe_added = False
    if len(words) < 20 and not probe_already_exists and curr_ans_idx < 3:
        try:
            from app.agent.nodes.interviewer import generate_followup_probe
            probe_question = await generate_followup_probe(q_text, answer_text)
            if probe_question:
                new_probe_q = {
                    "question": f"[Follow-up] {probe_question}",
                    "topic": "Clarification",
                    "difficulty": "Adaptive",
                    "is_probe": True,
                    "is_adaptive": True,
                    "timer_seconds": 45
                }
                raw_questions.append(new_probe_q)
                probe_added = True
        except Exception as e:
            print(f"[Interview] Error generating follow-up probe: {e}")

    # Next AI question to log into transcript for audit/display
    next_cand_turn_idx = curr_ans_idx + 1
    if next_cand_turn_idx < len(raw_questions):
        next_q_obj = raw_questions[next_cand_turn_idx]
        next_q_text = next_q_obj.get("question") if isinstance(next_q_obj, dict) else str(next_q_obj)
        transcript_list.append({"role": "ai", "message": next_q_text, "time": now_str})

    # Calculate cumulative candidate antiCheatMetadata across all candidate turns
    total_blur = 0
    total_focus = 0.0
    total_paste_cnt = 0
    total_pasted_ch = 0
    total_ans_ch = 0
    all_timestamps = []
    all_flags = []

    for turn in transcript_list:
        if isinstance(turn, dict) and turn.get("role") == "candidate":
            t_telemetry = turn.get("telemetry") or {}
            if isinstance(t_telemetry, dict):
                total_blur += int(t_telemetry.get("blur_count") or t_telemetry.get("blurCount") or 0)
                total_focus += float(t_telemetry.get("focus_duration_seconds") or t_telemetry.get("focusDuration") or t_telemetry.get("focus_duration") or 0.0)
                total_paste_cnt += int(t_telemetry.get("paste_count") or t_telemetry.get("pasteCount") or 0)
                total_pasted_ch += int(t_telemetry.get("total_pasted_chars") or t_telemetry.get("totalPastedChars") or 0)
                
                turn_msg_len = len(turn.get("message", ""))
                t_ans_ch = int(t_telemetry.get("total_answer_chars") or t_telemetry.get("totalAnswerChars") or turn_msg_len)
                total_ans_ch += t_ans_ch
                
                ts = t_telemetry.get("paste_timestamps") or t_telemetry.get("pasteTimestamps") or []
                if isinstance(ts, list):
                    all_timestamps.extend(ts)
                    
                fl = t_telemetry.get("flags") or []
                if isinstance(fl, list):
                    all_flags.extend(fl)

    cum_paste_ratio = round(total_pasted_ch / total_ans_ch, 4) if total_ans_ch > 0 else 0.0

    cumulative_anti_cheat_metadata = {
        "blur_count": total_blur,
        "blurCount": total_blur,
        "focus_duration_seconds": total_focus,
        "focusDuration": total_focus,
        "paste_count": total_paste_cnt,
        "pasteCount": total_paste_cnt,
        "total_pasted_chars": total_pasted_ch,
        "totalPastedChars": total_pasted_ch,
        "total_answer_chars": total_ans_ch,
        "totalAnswerChars": total_ans_ch,
        "paste_ratio": cum_paste_ratio,
        "pasteRatio": cum_paste_ratio,
        "paste_timestamps": all_timestamps,
        "pasteTimestamps": all_timestamps,
        "flags": list(dict.fromkeys([str(f) for f in all_flags if f]))
    }

    # Run deterministic anti-cheat signal analysis on accumulated candidate answers
    answers_given = [t.get("message", "") for t in transcript_list if isinstance(t, dict) and t.get("role") == "candidate"]
    from app.agent.nodes.evaluator import analyze_anti_cheat_signals
    heuristic_ai_score, heuristic_flags = analyze_anti_cheat_signals(answers_given, cumulative_anti_cheat_metadata)

    existing_flags = cumulative_anti_cheat_metadata.get("flags", [])
    flag_strings = list(dict.fromkeys(existing_flags + [f["flag"] for f in heuristic_flags if isinstance(f, dict) and "flag" in f]))
    cumulative_anti_cheat_metadata["flags"] = flag_strings

    # Save interviewTranscript, antiCheatMetadata, aiGeneratedLikelihoodScore, and antiCheatFlags to Evaluation table in Prisma
    eval_update: dict = {
        "interviewTranscript": Json(transcript_list),
        "antiCheatMetadata": Json(cumulative_anti_cheat_metadata),
        "aiGeneratedLikelihoodScore": heuristic_ai_score,
        "antiCheatFlags": Json(heuristic_flags)
    }
    if probe_added:
        eval_update["interviewQuestions"] = Json(raw_questions)

    await prisma.evaluation.update(
        where={"candidateId": candidate_id},
        data=eval_update
    )

    # Check if all questions (including any added probes) have been answered
    if next_cand_turn_idx >= len(raw_questions):
        ans_count = len(answers_given)
        avg_words = sum(len(a.split()) for a in answers_given) / max(1, ans_count) if ans_count > 0 else 0
        
        # Initial deterministic evaluation scores
        tech_score = min(95.0, max(40.0, avg_words * 0.8)) if not heuristic_flags else max(10.0, min(65.0, avg_words * 0.5))
        comm_score = min(95.0, max(40.0, avg_words * 0.7)) if not heuristic_flags else max(10.0, min(60.0, avg_words * 0.4))
        cult_score = min(90.0, max(50.0, 70.0))
        
        if any(f.get("severity") == "high" for f in heuristic_flags if isinstance(f, dict)):
            tech_score = min(25.0, tech_score)
            comm_score = min(25.0, comm_score)

        init_overall = round((tech_score * 0.4) + (comm_score * 0.3) + (cult_score * 0.3), 1)

        await prisma.evaluation.update(
            where={"candidateId": candidate_id},
            data={
                "overallScore": init_overall,
                "technicalScore": tech_score,
                "communicationScore": comm_score,
                "culturalFitScore": cult_score,
                "aiGeneratedLikelihoodScore": heuristic_ai_score,
                "antiCheatFlags": Json(heuristic_flags),
            }
        )

        await prisma.candidate.update(
            where={"id": candidate_id},
            data={"status": "interview_completed"}
        )
        import asyncio
        asyncio.create_task(_run_evaluator_background(candidate_id, candidate, transcript_list))

async def resume_pipeline(candidate_id: str, resume_data: Any, checkpointer=None):
    candidate = await prisma.candidate.find_unique(where={"id": candidate_id})
    if candidate and candidate.status == "interviewing":
        await process_interview_answer(candidate_id, str(resume_data))
        return

    from langgraph.types import Command
    
    async with get_checkpointer(checkpointer) as active_checkpointer:
        graph = build_recruitment_graph(checkpointer=active_checkpointer)
        config = {"configurable": {"thread_id": candidate_id}}
        interrupt_value = None
        final_state = None
        try:
            events = graph.astream(Command(resume=resume_data), config=config, stream_mode="updates")
            async for event in events:
                for node_name, node_output in event.items():
                    if isinstance(node_output, dict) and "log" in node_output:
                        for log_msg in node_output.get("log", []):
                            log_event(candidate_id, node_name, log_msg)
                    if node_name == "__interrupt__":
                        interrupt_value = node_output[0].value
                        
            final_state_res = await graph.aget_state(config)
            final_state = final_state_res.values
        except Exception as e:
            log_error(candidate_id, "resume_pipeline", e)
            await prisma.candidate.update(
                where={"id": candidate_id},
                data={
                    "status": "screening",
                    "rejectionReason": None
                }
            )
    
    if final_state:
        if str(resume_data).lower() == "reject" or final_state.get("pipeline_status") == "rejected":
            status = "rejected"
        elif interrupt_value == "hold_for_review":
            status = "screening_hold"
        elif str(resume_data).lower() in ["override", "approve"] or final_state.get("pipeline_status") == "shortlisted":
            status = "shortlisted"
        else:
            status = final_state.get("pipeline_status", "shortlisted")
        
        update_data = {"status": status}
            
        if final_state.get("rejection_reason"):
            update_data["rejectionReason"] = final_state["rejection_reason"]
            
        if final_state.get("screening_result") and status != "rejected" and final_state.get("pipeline_status") != "rejected":
            base_score = final_state["screening_result"].fit_score
            update_data["fitScore"] = min(100.0, max(0.0, float(base_score))) if base_score is not None else None
        else:
            update_data["fitScore"] = None
            
        if final_state.get("candidate_profile"):
            profile = final_state["candidate_profile"]
            if hasattr(profile, "model_dump"):
                profile_dict = profile.model_dump()
            else:
                profile_dict = profile

            profile_update = {
                "name": profile_dict.get("name"),
                "email": profile_dict.get("email"),
                "phone": profile_dict.get("phone"),
                "skills": profile_dict.get("skills", []),
                "education": profile_dict.get("education", []),
            }
            update_data.update({k: v for k, v in profile_update.items() if v is not None})
            
        if final_state.get("total_cost") is not None:
            update_data["apiCost"] = round(float(final_state.get("total_cost", 0.0)), 6)
        if final_state.get("stage_costs"):
            update_data["costBreakdown"] = Json(final_state["stage_costs"])
            
        await prisma.candidate.update(where={"id": candidate_id}, data=update_data)

        
        # Save evaluation report if available
        evaluation_report = final_state.get("evaluation_report")
        
        # Auto-generate evaluation for candidate if missing after JD screening
        if not evaluation_report and final_state.get("screening_result"):
            res = final_state["screening_result"]
            evaluation_report = _build_evaluation_from_screening(res, evaluation_strictness)
        elif not evaluation_report and status == "rejected" and final_state.get("rejection_reason"):
            from app.agent.schemas import EvaluationReport
            evaluation_report = EvaluationReport(
                overall_score=0.0,
                communication_score=0.0,
                technical_score=0.0,
                cultural_fit_score=0.0,
                strengths=[],
                concerns=["Candidate was rejected prior to interview."],
                recommendation="reject",
                summary=final_state["rejection_reason"]
            )
            
        if evaluation_report:
            existing_eval = await prisma.evaluation.find_unique(where={"candidateId": candidate_id})
            eval_data = {
                "overallScore": evaluation_report.overall_score,
                "technicalScore": evaluation_report.technical_score,
                "communicationScore": evaluation_report.communication_score,
                "culturalFitScore": evaluation_report.cultural_fit_score,
                "recommendation": evaluation_report.recommendation,
                "summary": evaluation_report.summary,
                "strengths": evaluation_report.strengths,
                "concerns": evaluation_report.concerns,
                "chainOfThought": evaluation_report.chain_of_thought,
            }
            if evaluation_report.score_breakdown:
                eval_data["scoreBreakdown"] = Json(evaluation_report.score_breakdown.dict())
            if final_state.get("interview_questions"):
                eval_data["interviewQuestions"] = Json([q.dict() for q in final_state["interview_questions"]])
                
            if not existing_eval:
                eval_data["candidate"] = {"connect": {"id": candidate_id}}
                await prisma.evaluation.create(data=eval_data)
            else:
                await prisma.evaluation.update(where={"candidateId": candidate_id}, data=eval_data)
    elif interrupt_value:
        fallback_status = "screening_hold" if interrupt_value == "hold_for_review" else (
            "rejected" if str(resume_data).lower() == "reject" else "shortlisted"
        )
        await prisma.candidate.update(
            where={"id": candidate_id},
            data={"status": fallback_status}
        )

async def generate_on_demand_questions(candidate_id: str):
    """
    On-demand question generation invoked only when a candidate opens their protected link,
    verifies their email, accepts the policy, and clicks 'Start Assessment'.
    """
    candidate = await prisma.candidate.find_unique(
        where={"id": candidate_id},
        include={"campaign": True, "resume": True, "evaluation": True}
    )
    if not candidate:
        raise ValueError(f"Candidate {candidate_id} not found")
        
    # If questions already generated in evaluation record, ensure status is interviewing & transcript initialized
    if candidate.evaluation and candidate.evaluation.interviewQuestions:
        questions_json = candidate.evaluation.interviewQuestions
        if isinstance(questions_json, str):
            import json
            questions_json = json.loads(questions_json)

        transcript = candidate.evaluation.interviewTranscript or []
        if isinstance(transcript, str):
            import json
            transcript = json.loads(transcript)

        if not transcript and questions_json:
            first_q = questions_json[0]
            q1_text = first_q.get("question") if isinstance(first_q, dict) else str(first_q)
            from datetime import datetime
            transcript = [{"role": "ai", "message": q1_text, "time": datetime.now().strftime("%I:%M %p")}]
            await prisma.evaluation.update(
                where={"candidateId": candidate_id},
                data={"interviewTranscript": Json(transcript)}
            )

        if candidate.status in ["invited", "shortlisted"]:
            await prisma.candidate.update(
                where={"id": candidate_id},
                data={"status": "interviewing"}
            )
            
        return questions_json

    import json
    from app.agent.schemas import CandidateProfile, ScreeningResult, ScoreBreakdown
    from app.agent.nodes.question_generator import question_generator_node

    profile_data = candidate.resume.structuredProfile if candidate.resume and candidate.resume.structuredProfile else {}
    if isinstance(profile_data, str):
        profile_data = json.loads(profile_data)
        
    candidate_profile = CandidateProfile(**profile_data) if profile_data else CandidateProfile(name=candidate.name or "Candidate")
    
    fit_score_val = int(round(candidate.fitScore)) if candidate.fitScore is not None else 0

    screening_result = ScreeningResult(
        fit_score=fit_score_val,
        score_breakdown=ScoreBreakdown(
            required_skills_score=fit_score_val,
            experience_score=fit_score_val,
            nice_to_have_score=fit_score_val,
            trajectory_score=fit_score_val,
        ),
        must_have=[],
        nice_to_have=[],
        experience_assessment=candidate.evaluation.summary if candidate.evaluation else "",
        reasoning_summary=candidate.evaluation.summary if candidate.evaluation else "",
        decision="advance"
    )

    state = {
        "candidate_profile": candidate_profile,
        "screening_result": screening_result,
        "job_description": candidate.campaign.jobDescription if candidate.campaign else "",
        "interview_config": candidate.campaign.interviewConfig if candidate.campaign else None
    }

    res = await question_generator_node(state)
    questions = res.get("interview_questions", [])
    
    questions_json = [q.model_dump() if hasattr(q, "model_dump") else q.dict() for q in questions]
    
    initial_transcript = []
    if questions_json:
        q1_text = questions_json[0].get("question") if isinstance(questions_json[0], dict) else str(questions_json[0])
        from datetime import datetime
        initial_transcript = [{"role": "ai", "message": q1_text, "time": datetime.now().strftime("%I:%M %p")}]

    # Save to Evaluation table in Prisma
    if candidate.evaluation:
        await prisma.evaluation.update(
            where={"candidateId": candidate_id},
            data={
                "interviewQuestions": Json(questions_json),
                "interviewTranscript": Json(initial_transcript)
            }
        )
    else:
        await prisma.evaluation.create(
            data={
                "candidateId": candidate_id,
                "overallScore": candidate.fitScore or 0.0,
                "technicalScore": 0.0,
                "communicationScore": 0.0,
                "culturalFitScore": 0.0,
                "recommendation": "shortlist",
                "summary": "Assessment started",
                "strengths": [],
                "concerns": [],
                "interviewQuestions": Json(questions_json),
                "interviewTranscript": Json(initial_transcript)
            }
        )

    # Update candidate status to interviewing
    await prisma.candidate.update(
        where={"id": candidate_id},
        data={"status": "interviewing"}
    )
    
    return questions_json


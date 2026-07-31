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
        raw_db_url = os.environ.get("DATABASE_URL") or os.environ.get("DIRECT_URL")
        if raw_db_url:
            parsed = urlparse(raw_db_url)
            db_url = urlunparse((parsed.scheme, parsed.netloc, parsed.path, '', '', ''))
        else:
            db_url = ""
        if db_url:
            async with await AsyncConnection.connect(
                db_url, autocommit=True, prepare_threshold=None, row_factory=dict_row
            ) as conn:
                new_cp = AsyncPostgresSaver(conn)
                await new_cp.setup()
                yield new_cp
        else:
            yield None

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
            events = graph.astream(cast(Any, input_state), config=config, stream_mode="updates")
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
            log_error(candidate_id, "start_candidate_pipeline", e)
            await prisma.candidate.update(
                where={"id": candidate_id},
                data={
                    "status": "screening",
                    "rejectionReason": None
                }
            )
            
    if final_state:
        if interrupt_value == "hold_for_review":
            status = "screening_hold"
        elif interrupt_value or final_state.get("pipeline_status") == "shortlisted":
            status = "shortlisted"
        else:
            status = final_state.get("pipeline_status", "shortlisted")
        
        update_data = {"status": status}
            
        if final_state.get("rejection_reason"):
            update_data["rejectionReason"] = final_state["rejection_reason"]
            
        if final_state.get("screening_result"):
            base_score = final_state["screening_result"].fit_score
            semantic_bonus = final_state.get("semantic_score", 0.0)
            update_data["fitScore"] = base_score + semantic_bonus
        elif final_state.get("semantic_score") is not None:
            update_data["fitScore"] = final_state.get("semantic_score")
            
        if final_state.get("candidate_profile"):
            profile = final_state["candidate_profile"]
            if hasattr(profile, "model_dump"):
                profile_dict = profile.model_dump()
            else:
                profile_dict = profile
            update_data.update({
                "name": profile_dict.get("name"),
                "email": profile_dict.get("email"),
                "phone": profile_dict.get("phone"),
                "skills": profile_dict.get("skills", []),
                "education": profile_dict.get("education", [])
            })
            
        if final_state.get("total_cost") is not None:
            update_data["apiCost"] = final_state.get("total_cost", 0.0)
            
        await prisma.candidate.update(where={"id": candidate_id}, data=update_data)
        
        # Save evaluation report if available
        evaluation_report = final_state.get("evaluation_report")
        
        # Auto-generate evaluation for rejected candidates if missing
        if not evaluation_report and final_state.get("screening_result"):
            from app.agent.schemas import EvaluationReport
            res = final_state["screening_result"]
            missing = [req.requirement for req in res.must_have if req.match == "none"]
            matched = [req.requirement for req in res.must_have if req.match != "none"] + [req.requirement for req in res.nice_to_have if req.match != "none"]
            evaluation_report = EvaluationReport(
                overall_score=res.fit_score,
                communication_score=0.0,
                technical_score=0.0,
                cultural_fit_score=0.0,
                strengths=matched,
                concerns=missing,
                recommendation="shortlist" if res.decision == "advance" else res.decision,
                summary=res.reasoning_summary,
                chain_of_thought=f"{res.experience_assessment}\n\n{res.reasoning_summary}"
            )
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
        from app.agent.schemas import CandidateProfile, ScreeningResult, ScoreBreakdown, InterviewTranscript, InterviewQuestion
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

        eval_state = {
            "candidate_profile": candidate_profile,
            "screening_result": screening_result,
            "job_description": candidate.campaign.jobDescription if candidate.campaign else "",
            "interview_transcript": it_obj,
            "jd_matcher_prompt_variant": candidate.campaign.evaluationStrictness if candidate.campaign else "moderate"
        }

        from app.agent.nodes.evaluator import evaluator_node
        eval_res = await evaluator_node(eval_state)
        report = eval_res.get("evaluation_report")

        if report:
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
                }
            )
            await prisma.candidate.update(
                where={"id": candidate_id},
                data={
                    "apiCost": candidate.apiCost + eval_res.get("total_cost", 0.0)
                }
            )
    except Exception as e:
        print(f"[Interview] Evaluator background task failed for {candidate_id}: {e}")

async def process_interview_answer(candidate_id: str, answer_text: str):
    """
    Processes candidate answer submission for an active interview session.
    Updates interview transcript, handles non-blocking adaptive probing,
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
    from prisma.Json import Json
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

    # Record candidate answer
    transcript_list.append({"role": "candidate", "message": answer_text, "time": now_str})

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
                    "difficulty": "Adaptive"
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

    # Save to Evaluation table in Prisma
    eval_update: dict = {"interviewTranscript": Json(transcript_list)}
    if probe_added:
        eval_update["interviewQuestions"] = Json(raw_questions)

    await prisma.evaluation.update(
        where={"candidateId": candidate_id},
        data=eval_update
    )

    # Check if all questions (including any added probes) have been answered
    if next_cand_turn_idx >= len(raw_questions):
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
        if interrupt_value == "hold_for_review":
            status = "screening_hold"
        elif interrupt_value or final_state.get("pipeline_status") == "shortlisted":
            status = "shortlisted"
        else:
            status = final_state.get("pipeline_status", "shortlisted")
        
        update_data = {"status": status}
            
        if final_state.get("rejection_reason"):
            update_data["rejectionReason"] = final_state["rejection_reason"]
            
        if final_state.get("screening_result"):
            base_score = final_state["screening_result"].fit_score
            semantic_bonus = final_state.get("semantic_score", 0.0)
            update_data["fitScore"] = base_score + semantic_bonus
        elif final_state.get("semantic_score") is not None:
            update_data["fitScore"] = final_state.get("semantic_score")
            
        if final_state.get("candidate_profile"):
            profile = final_state["candidate_profile"]
            if hasattr(profile, "model_dump"):
                profile_dict = profile.model_dump()
            else:
                profile_dict = profile
            update_data.update({
                "name": profile_dict.get("name"),
                "email": profile_dict.get("email"),
                "phone": profile_dict.get("phone"),
                "skills": profile_dict.get("skills", []),
                "education": profile_dict.get("education", [])
            })
            
        if final_state.get("total_cost") is not None:
            update_data["apiCost"] = final_state.get("total_cost", 0.0)
            
        await prisma.candidate.update(where={"id": candidate_id}, data=update_data)
        
        # Save evaluation report if available
        evaluation_report = final_state.get("evaluation_report")
        
        # Auto-generate evaluation for rejected candidates if missing
        if not evaluation_report and final_state.get("screening_result"):
            from app.agent.schemas import EvaluationReport
            res = final_state["screening_result"]
            missing = [req.requirement for req in res.must_have if req.match == "none"]
            matched = [req.requirement for req in res.must_have if req.match != "none"] + [req.requirement for req in res.nice_to_have if req.match != "none"]
            evaluation_report = EvaluationReport(
                overall_score=res.fit_score,
                communication_score=0.0,
                technical_score=0.0,
                cultural_fit_score=0.0,
                strengths=matched,
                concerns=missing,
                recommendation="shortlist" if res.decision == "advance" else res.decision,
                summary=res.reasoning_summary,
                chain_of_thought=f"{res.experience_assessment}\n\n{res.reasoning_summary}"
            )
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
            if final_state.get("interview_questions"):
                eval_data["interviewQuestions"] = Json([q.dict() for q in final_state["interview_questions"]])
                
            if not existing_eval:
                eval_data["candidate"] = {"connect": {"id": candidate_id}}
                await prisma.evaluation.create(data=eval_data)
            else:
                await prisma.evaluation.update(where={"candidateId": candidate_id}, data=eval_data)
    elif interrupt_value:
        fallback_status = "screening_hold" if interrupt_value == "hold_for_review" else "shortlisted"
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


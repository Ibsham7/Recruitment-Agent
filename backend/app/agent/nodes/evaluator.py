import json
from typing import Any
from app.agent.config import get_model
from app.agent.schemas import EvaluationReport
from app.agent.state import RecruitmentState
from langchain_core.messages import HumanMessage, SystemMessage
from app.agent.prompts import EVALUATOR_PROMPTS


def analyze_anti_cheat_signals(answers_given: list[str], telemetry: dict[str, Any]) -> tuple[float, list[dict[str, str]]]:
    """
    Perform deterministic analysis of candidate answer text and anti-cheat telemetry
    for AI-generated text styling and security anti-cheat signals.
    Supports both camelCase and snake_case telemetry metadata keys.
    """
    flags = []
    heuristic_score = 0.0
    
    combined_answers = "\n\n".join(answers_given or [])
    
    # 1. Extract telemetry metrics supporting both camelCase and snake_case
    def _get_metric(keys: list[str], default: Any = 0) -> Any:
        for k in keys:
            if k in telemetry and telemetry[k] is not None:
                return telemetry[k]
        return default

    blur_count = int(_get_metric(["blur_count", "blurCount", "tabSwitches"], 0))
    paste_count = int(_get_metric(["paste_count", "pasteCount"], 0))
    total_pasted = int(_get_metric(["total_pasted_chars", "totalPastedChars"], 0))
    total_ans_ch = int(_get_metric(["total_answer_chars", "totalAnswerChars"], len(combined_answers)))
    
    raw_ratio = _get_metric(["paste_ratio", "pasteRatio"], None)
    if raw_ratio is not None:
        paste_ratio = float(raw_ratio)
        if paste_ratio > 1.0 and total_ans_ch > 0:
            paste_ratio = paste_ratio / 100.0
    elif total_ans_ch > 0 and total_pasted > 0:
        paste_ratio = round(total_pasted / max(1, total_ans_ch), 4)
    else:
        paste_ratio = 0.0

    # 2. Structural Overuse of Markdown
    markdown_headers = combined_answers.count("#")
    bullet_points = combined_answers.count("\n- ") + combined_answers.count("\n* ") + combined_answers.count("\n1. ") + combined_answers.count("\n2. ") + combined_answers.count("• ")
    bold_text = combined_answers.count("**")
    
    if markdown_headers >= 2 or bullet_points >= 4 or bold_text >= 6:
        flags.append({
            "flag": "MARKDOWN_OVERUSE",
            "severity": "medium" if markdown_headers < 3 and bullet_points < 8 else "high",
            "description": f"Candidate response contains structural overuse of Markdown formatting (headers: {markdown_headers}, bullets: {bullet_points}, bolding: {bold_text}) typical of generated text."
        })
        heuristic_score += 35.0

    # 3. Robotic / LLM Boilerplate Transitions & Tone
    boilerplate_phrases = [
        "in summary", "furthermore", "certainly!", "to address your question",
        "in conclusion", "as an ai", "it is important to note", "here is a breakdown",
        "to answer your question", "firstly,", "secondly,", "thirdly,",
        "overall,", "additionally,", "moreover,", "in terms of"
    ]
    detected_phrases = [phrase for phrase in boilerplate_phrases if phrase in combined_answers.lower()]
    if detected_phrases:
        flags.append({
            "flag": "LLM_BOILERPLATE_TRANSITIONS",
            "severity": "high" if len(detected_phrases) >= 2 else "medium",
            "description": f"Candidate response exhibits robotic LLM transition boilerplate: {', '.join(detected_phrases)}."
        })
        heuristic_score += 45.0 if len(detected_phrases) >= 2 else 25.0

    # 4. Large Pasted Text / Massive AI Blob Telemetry Detection
    if total_pasted > 1000 or paste_count >= 1:
        if total_pasted >= 5000:
            flags.append({
                "flag": "MASSIVE_PASTE_BLOB",
                "severity": "high",
                "description": f"Massive copy-paste detected ({total_pasted} pasted characters across {paste_count} paste events). Definite external text injection."
            })
            heuristic_score += 85.0
        elif total_pasted >= 300 or paste_ratio > 0.30 or paste_count >= 2:
            severity = "high" if (paste_ratio > 0.50 or total_pasted > 800) else "medium"
            flags.append({
                "flag": "HIGH_PASTE_RATIO",
                "severity": severity,
                "description": f"Telemetry metadata flags paste activity ({paste_ratio:.1%} paste ratio, {paste_count} paste events, {total_pasted} pasted characters)."
            })
            heuristic_score += 50.0 if severity == "high" else 30.0

    # 5. Frequent tab switches / window blur events
    if blur_count >= 3:
        flags.append({
            "flag": "FREQUENT_TAB_SWITCHES",
            "severity": "high" if blur_count >= 5 else "medium",
            "description": f"Telemetry metadata recorded {blur_count} window blur/tab switch events during the interview assessment."
        })
        heuristic_score += 35.0 if blur_count >= 5 else 20.0

    # 6. Length & Word Count Anomaly (Unusually massive text for written interview turns)
    words = combined_answers.split()
    if len(words) > 400 and paste_count > 0:
        flags.append({
            "flag": "BURST_TEXT_GENERATION",
            "severity": "high",
            "description": f"Unusually large text response submitted ({len(words)} words) with recorded paste activity."
        })
        heuristic_score += 30.0

    final_score = min(100.0, max(0.0, heuristic_score))
    return final_score, flags


from app.core.logging import logger

async def evaluator_node(state: RecruitmentState) -> dict:
    """Score the interview transcript and write the evaluation report with AI detection & security flags."""

    profile = state.get("candidate_profile")
    screening = state.get("screening_result")
    transcript = state.get("interview_transcript")
    jd = state.get("job_description")

    if profile is None:
        raise ValueError("candidate_profile is required for evaluation")
    if screening is None:
        raise ValueError("screening_result is required for evaluation")
    if jd is None:
        raise ValueError("job_description is required for evaluation")

    if transcript is None:
        raise ValueError("interview_transcript is required for evaluation")

    logger.info(f"[Evaluator] Evaluating: {profile.name}")
    # Build the Q&A transcript for the model to read
    qa_pairs = []
    for i, (q, a) in enumerate(zip(
        transcript.questions_asked, transcript.answers_given
    )):
        qa_pairs.append(
            f"Q{i+1} [{q.category.upper()}]: {q.question}\n"
            f"Answer: {a}\n"
            f"Expected: {q.what_to_look_for}"
        )
    qa_text = "\n\n".join(qa_pairs)

    # Extract anti-cheat telemetry metadata if provided in state or transcript
    telemetry_raw = state.get("anti_cheat_telemetry") or getattr(transcript, "anti_cheat_telemetry", None) or {}
    if hasattr(telemetry_raw, "model_dump"):
        telemetry_dict = telemetry_raw.model_dump()
    elif isinstance(telemetry_raw, dict):
        telemetry_dict = telemetry_raw
    else:
        telemetry_dict = {}

    heuristic_ai_score, heuristic_flags = analyze_anti_cheat_signals(
        transcript.answers_given, telemetry_dict
    )

    telemetry_text = f"""
SECURITY & TELEMETRY METADATA:
- Blur / Tab Switch Count: {telemetry_dict.get('blur_count', 0)}
- Focus Duration (seconds): {telemetry_dict.get('focus_duration_seconds', 0)}
- Paste Count: {telemetry_dict.get('paste_count', 0)}
- Total Pasted Chars: {telemetry_dict.get('total_pasted_chars', 0)}
- Total Answer Chars: {telemetry_dict.get('total_answer_chars', 0)}
- Paste Ratio: {telemetry_dict.get('paste_ratio', 0.0):.2f}
- Telemetry Flags: {', '.join(telemetry_dict.get('flags', [])) or 'None'}
"""

    missing = [req.requirement for req in screening.must_have if req.match == "none"]
    prompt = f"""
JOB: (Summary) {jd[:500]}...

CANDIDATE: {profile.name}
Screening score: {screening.fit_score}/100
Missing requirements: {', '.join(missing) or 'none'}

INTERVIEW TRANSCRIPT:
{qa_text}

{telemetry_text}

Evaluate this candidate's interview performance across technical, communication, and cultural fit dimensions.
Analyze candidate answers and telemetry for AI-generated text styling (structural overuse of Markdown, robotic LLM boilerplate transitions) and security anti-cheat signals (high paste ratio, frequent tab switches).
Ensure your output populates:
- `ai_generated_likelihood_score` (float 0.0 to 100.0)
- `anti_cheat_flags` (list of flag objects `[{{"flag": "...", "severity": "...", "description": "..."}}]`)
"""

    eval_mode = state.get("jd_matcher_prompt_variant") or "default"
    system_prompt = EVALUATOR_PROMPTS.get(eval_mode, EVALUATOR_PROMPTS["default"])

    max_retries = 3
    report = None
    total_cost = 0.0
    for attempt in range(max_retries):
        max_tokens = 4000 if attempt == 0 else 8000
        model = get_model("smart", max_tokens=max_tokens)
        structured_model = model.with_structured_output(EvaluationReport, method="json_schema", include_raw=True)
        try:
            result = await structured_model.ainvoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=prompt)
            ])
            parsed_res = result.get("parsed") if isinstance(result, dict) else None
            if not parsed_res:
                err = result.get("parsing_error") if isinstance(result, dict) else None
                raise ValueError(f"Failed to parse EvaluationReport: {err or 'LLM output was truncated or unparseable'}")
            report = parsed_res
            from app.agent.utils import extract_cost
            total_cost = extract_cost(result)
            
            # Populate & synthesize ai_generated_likelihood_score and anti_cheat_flags
            llm_ai_score = float(report.ai_generated_likelihood_score or 0.0)
            report.ai_generated_likelihood_score = min(100.0, max(llm_ai_score, heuristic_ai_score))
            
            merged_flags = []
            existing_flag_names = set()
            for flag_obj in (report.anti_cheat_flags or []):
                if isinstance(flag_obj, dict) and "flag" in flag_obj:
                    merged_flags.append(flag_obj)
                    existing_flag_names.add(flag_obj["flag"])
            for h_flag in heuristic_flags:
                if h_flag["flag"] not in existing_flag_names:
                    merged_flags.append(h_flag)
                    existing_flag_names.add(h_flag["flag"])
            report.anti_cheat_flags = merged_flags

            if not report.interview_score:
                report.interview_score = report.overall_score
            report.chain_of_thought = f"Screening Fit Score: {screening.fit_score}/100\nExperience Assessment: {screening.experience_assessment}\nAI Likelihood Score: {report.ai_generated_likelihood_score:.1f}/100\n\nInterview Evaluation Summary: {report.summary}"
            break
        except Exception as e:
            logger.warning(f"[Evaluator] Attempt {attempt+1} failed: {e}.")
            if attempt == max_retries - 1:
                raise RuntimeError(f"Failed to generate evaluation report after {max_retries} attempts: {e}")

    return {
        "evaluation_report": report,
        "pipeline_status": "review",   # signal ready for human review
        "log": [f"Evaluated: {report.recommendation.upper()} (score={report.overall_score}, ai_likelihood={report.ai_generated_likelihood_score})"],
        "total_cost": total_cost
    }
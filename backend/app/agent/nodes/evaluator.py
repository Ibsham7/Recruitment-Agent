import json
from app.agent.config import get_model
from app.agent.schemas import EvaluationReport
from app.agent.state import RecruitmentState
from langchain_core.messages import HumanMessage, SystemMessage
from app.agent.prompts import EVALUATOR_PROMPTS


async def evaluator_node(state: RecruitmentState) -> dict:
    """Score the interview transcript and write the evaluation report."""

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

    print(f"\n[Evaluator] Evaluating: {profile.name}")
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

    missing = [req.requirement for req in screening.must_have if req.match == "none"]
    prompt = f"""
JOB: (Summary) {jd[:500]}...

CANDIDATE: {profile.name}
Screening score: {screening.fit_score}/100
Missing requirements: {', '.join(missing) or 'none'}

INTERVIEW TRANSCRIPT:
{qa_text}

Evaluate this candidate's interview performance.
"""

    eval_mode = state.get("jd_matcher_prompt_variant") or "default"
    system_prompt = EVALUATOR_PROMPTS.get(eval_mode, EVALUATOR_PROMPTS["default"])

    model = get_model("smart")
    structured_model = model.with_structured_output(EvaluationReport, method="json_schema", include_raw=True)
    max_retries = 3
    report = None
    total_cost = 0.0
    for attempt in range(max_retries):
        try:
            result = await structured_model.ainvoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=prompt)
            ])
            report = result["parsed"]
            from app.agent.utils import extract_cost
            total_cost = extract_cost(result)
            report.chain_of_thought = f"{screening.experience_assessment}\n\n{screening.reasoning_summary}"
            break
        except Exception as e:
            print(f"  [Evaluator] Attempt {attempt+1} failed: {e}.")
            if attempt == max_retries - 1:
                raise RuntimeError(f"Failed to generate evaluation report after {max_retries} attempts: {e}")

    return {
        "evaluation_report": report,
        "pipeline_status": "review",   # signal ready for human review
        "log": [f"Evaluated: {report.recommendation.upper()} (score={report.overall_score})"],
        "total_cost": total_cost
    }
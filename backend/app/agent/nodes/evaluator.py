import json
from app.agent.config import get_model
from app.agent.schemas import EvaluationReport
from app.agent.state import RecruitmentState
from app.agent.utils import extract_json
from langchain_core.messages import HumanMessage, SystemMessage

EVALUATOR_SYSTEM = """
You are a senior hiring manager evaluating an interview transcript.
Assess the candidate on four dimensions and produce a structured report.

Return ONLY a valid JSON object. Do NOT wrap it in ```json code blocks. Do NOT include any conversational text before or after the JSON:
{
  "overall_score": 0-100,
  "communication_score": 0-100,
  "technical_score": 0-100,
  "cultural_fit_score": 0-100,
  "strengths": ["strength1", "strength2"],
  "concerns": ["concern1", "concern2"],
  "recommendation": "shortlist" | "reject" | "hold",
  "summary": "2-3 sentence overall assessment"
}

Recommendation guide:
- shortlist: overall >= 65 AND no critical concerns
- hold: overall >= 55 AND some concerns worth flagging
- reject: overall < 55 OR critical red flag present

Be honest. A candidate who gave vague non-answers should score low 
on communication even if their CV is strong. Judge the interview, not the CV.
"""

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

    prompt = f"""
JOB: (Summary) {jd[:500]}...

CANDIDATE: {profile.name}
Screening score: {screening.fit_score}/100
Missing requirements: {', '.join(screening.missing_requirements) or 'none'}

INTERVIEW TRANSCRIPT:
{qa_text}

Evaluate this candidate's interview performance.
"""

    model = get_model("smart")
    max_retries = 3
    report = None
    for attempt in range(max_retries):
        try:
            response = await model.ainvoke([
                SystemMessage(content=EVALUATOR_SYSTEM),
                HumanMessage(content=prompt)
            ])
            raw_json = extract_json(response.content)
            report = EvaluationReport(**json.loads(raw_json))
            break
        except Exception as e:
            print(f"  [Evaluator] Attempt {attempt+1} failed: {e}. Raw response: {getattr(response, 'content', 'None') if 'response' in locals() else 'None'}")
            if attempt == max_retries - 1:
                print(f"  [Evaluator] All {max_retries} attempts failed. Falling back to HOLD.")
                report = EvaluationReport(
                    overall_score=50,
                    technical_score=50,
                    communication_score=50,
                    cultural_fit_score=50,
                    strengths=[],
                    concerns=["Failed to generate AI evaluation due to LLM degradation."],
                    recommendation="hold",
                    summary=f"Evaluation failed after {max_retries} retries: {str(e)}"
                )

    return {
        "evaluation_report": report,
        "pipeline_status": "review",   # signal ready for human review
        "log": [f"Evaluated: {report.recommendation.upper()} (score={report.overall_score})"]
    }
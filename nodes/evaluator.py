import json
from config import get_model
from schemas import EvaluationReport
from state import RecruitmentState
from langchain_core.messages import HumanMessage, SystemMessage

EVALUATOR_SYSTEM = """
You are a senior hiring manager evaluating an interview transcript.
Assess the candidate on four dimensions and produce a structured report.

Return ONLY valid JSON:
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

def evaluator_node(state: RecruitmentState) -> dict:
    """Score the interview transcript and write the evaluation report."""

    profile = state.get("candidate_profile")
    screening = state.get("screening_result")
    transcript = state.get("interview_transcript")
    jd = state.get("job_description")

    if profile is None:
        raise ValueError("candidate_profile is required for evaluation")
    if screening is None:
        raise ValueError("screening_result is required for evaluation")
    if transcript is None:
        raise ValueError("interview_transcript is required for evaluation")
    if jd is None:
        raise ValueError("job_description is required for evaluation")

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
    response = model.invoke([
        SystemMessage(content=EVALUATOR_SYSTEM),
        HumanMessage(content=prompt)
    ])

    raw_json = response.content.strip().strip("```json").strip("```").strip() # type: ignore
    report = EvaluationReport(**json.loads(raw_json))

    return {
        "evaluation_report": report,
        "pipeline_status": "awaiting_human",   # signal human review gate
        "log": [f"Evaluated: {report.recommendation.upper()} (score={report.overall_score})"]
    }
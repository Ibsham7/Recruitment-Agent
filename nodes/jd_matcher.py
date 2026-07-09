import json
from config import get_model
from schemas import ScreeningResult
from state import RecruitmentState
from langchain_core.messages import HumanMessage, SystemMessage

JD_MATCHER_SYSTEM = """
You are a strict, objective recruitment screener. You compare a candidate profile 
against a job description and produce a structured match score.

Return ONLY valid JSON — no markdown, no explanation:
{
  "fit_score": 0-100,
  "matched_requirements": ["requirement met"],
  "missing_requirements": ["requirement not met"],
  "reasoning": "2-3 sentence explanation",
  "decision": "advance" or "reject"
}

Scoring guide:
- 80–100: Strong match. Clear advance.
- 60–79: Partial match. Advance if requirements are not strictly non-negotiable.
- 40–59: Weak match. Borderline — reject unless you have context suggesting growth.
- 0–39:  Poor match. Reject.

Decision rules:
- "advance" if fit_score >= 60
- "reject" if fit_score < 60

Be strict. A candidate who is 70% qualified but missing a critical mandatory requirement
should score low on that requirement. Do not inflate scores.
"""

def jd_matcher_node(state: RecruitmentState) -> dict:
    """Score the candidate against the job description."""
    profile = state.get("candidate_profile")
    if profile is None:
        raise ValueError("candidate_profile is required for JD matching")

    print(f"\n[JD Matcher] Scoring: {profile.name}")

    jd = state["job_description"]

    prompt  = f"""
JOB DESCRIPTION:
{jd}

CANDIDATE PROFILE:
Name: {profile.name }
Experience: {profile.total_experience_years} years
Education: {', '.join(profile.education)}
Skills: {', '.join(profile.skills)}
Previous Roles: {', '.join(profile.previous_roles)}
Achievements: {', '.join(profile.key_achievements)}

Score this candidate against the job description.
""" 

    model = get_model("fast")    # screening doesn't need the strongest model
    response = model.invoke([
        SystemMessage(content=JD_MATCHER_SYSTEM),
        HumanMessage(content=prompt)
    ])

    raw_json = response.content.strip().strip("```json").strip("```").strip() # type: ignore
    result = ScreeningResult(**json.loads(raw_json))

    if result.decision == "reject":
        return {
            "screening_result": result,
            "pipeline_status": "rejected",
            "rejection_reason": f"Screening score {result.fit_score}/100 — below threshold. {result.reasoning}",
            "log": [f"Screened: REJECT (score={result.fit_score})"]
        }

    return {
        "screening_result": result,
        "pipeline_status": "running",
        "log": [f"Screened: ADVANCE (score={result.fit_score})"]
    }
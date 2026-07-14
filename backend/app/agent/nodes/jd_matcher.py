import json
from app.agent.config import get_model
from app.agent.schemas import ScreeningResult
from app.agent.state import RecruitmentState
from app.agent.utils import extract_json
from langchain_core.messages import HumanMessage, SystemMessage

JD_MATCHER_SYSTEM = """
You are a strict, objective recruitment screener. You compare a candidate profile 
against a job description and produce a structured match score.

Return ONLY a valid JSON object. Do NOT wrap it in ```json code blocks. Do NOT include any conversational text before or after the JSON:
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

async def jd_matcher_node(state: RecruitmentState) -> dict:
    """Score the candidate against the job description."""
    profile = state.get("candidate_profile")
    if profile is None:
        raise ValueError("candidate_profile is required for JD matching")

    print(f"\n[JD Matcher] Scoring: {profile.name}")

    jd = state["job_description"]
    
    # We put JD in the system prompt for effective prompt caching across candidates
    system_prompt = JD_MATCHER_SYSTEM + f"\n\nJOB DESCRIPTION:\n{jd}"

    model = get_model("fast")    # screening doesn't need the strongest model
    
    # Exclude raw CV text to save tokens, only send the structured profile
    profile_dict = profile.model_dump()
    profile_dict.pop("raw_cv_text", None)
    
    response = await model.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"CANDIDATE PROFILE (JSON):\n{json.dumps(profile_dict, indent=2)}")
    ])

    raw_json = extract_json(response.content)
    result = ScreeningResult(**json.loads(raw_json))
    
    # Apply penalties from hard_filters
    penalties = state.get("penalties", [])
    deduction = 0
    penalty_reasons = []
    for p in penalties:
        sev = p.get("severity")
        if sev == "slight_penalize":
            deduction += 10
        elif sev == "intermediate_penalize":
            deduction += 20
        elif sev == "hard_penalize":
            deduction += 30
        penalty_reasons.append(p.get("reason"))
        
    if deduction > 0:
        result.fit_score = max(0, result.fit_score - deduction)
        result.reasoning += f" [Penalty applied: -{deduction} pts for: {', '.join(penalty_reasons)}]"
        # Re-evaluate decision based on new score
        if result.fit_score < 60:
            result.decision = "reject"

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
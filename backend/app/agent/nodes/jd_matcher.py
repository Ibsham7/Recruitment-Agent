import json
from app.agent.config import get_model
from app.agent.schemas import ScreeningResult
from app.agent.state import RecruitmentState
from app.agent.utils import extract_json
from langchain_core.messages import HumanMessage, SystemMessage

JD_MATCHER_SYSTEM = """
You are a fair and holistic recruitment screener. You compare a candidate profile 
against a job description and produce a structured match score. Evaluate the candidate's potential and transferable skills, not just exact keyword matches. Read the whole CV text and provide a short summary of it as well, covering everything not in the structured extracted portion (e.g. achievements, projects).

Return ONLY a valid JSON object. Do NOT wrap it in ```json code blocks. Do NOT include any conversational text before or after the JSON:
{
  "cv_summary": "Short summary of candidate including projects/achievements",
  "reasoning": "2-3 sentence explanation",
  "matched_requirements": ["requirement met"],
  "missing_requirements": ["requirement not met"],
  "fit_score": 0-100,
  "decision": "advance" or "hold" or "reject"
}

Scoring guide:
- 80–100: Strong match. Clear advance.
- 60–79: Good match. Advance.
- 50–59: Partial match. Hold for review.
- 0–49:  Poor match. Reject.

Decision rules:
- "advance" if fit_score >= 60
- "hold" if fit_score >= 50 and fit_score < 60
- "reject" if fit_score < 50
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
    
    # Send the full structured profile, including raw_cv_text so the LLM can extract additional details
    profile_dict = profile.model_dump()
    
    max_retries = 3
    result = None
    for attempt in range(max_retries):
        try:
            response = await model.ainvoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=f"CANDIDATE PROFILE (JSON):\n{json.dumps(profile_dict, indent=2)}")
            ])
            raw_json = extract_json(response.content)
            result = ScreeningResult(**json.loads(raw_json))
            break
        except Exception as e:
            print(f"  [JD Matcher] Attempt {attempt+1} failed: {e}. Raw response: {getattr(response, 'content', 'None') if 'response' in locals() else 'None'}")
            if attempt == max_retries - 1:
                print(f"  [JD Matcher] All {max_retries} attempts failed. Falling back to HOLD.")
                result = ScreeningResult(
                    fit_score=50,
                    matched_requirements=[],
                    missing_requirements=[],
                    reasoning=f"Error extracting structured evaluation from LLM after 3 retries: {str(e)}",
                    cv_summary="Candidate profile could not be accurately summarized due to LLM degradation.",
                    decision="hold"
                )
    
    # Apply penalties from hard_filters
    penalties = state.get("penalties", [])
    deduction = 0
    penalty_reasons = []
    for p in penalties:
        sev = p.get("severity")
        if sev == "slight_penalize":
            deduction += 5
        elif sev == "intermediate_penalize":
            deduction += 10
        elif sev == "hard_penalize":
            deduction += 20
        penalty_reasons.append(p.get("reason"))
        
    if deduction > 0:
        result.fit_score = max(0, result.fit_score - deduction)
        result.reasoning += f" [Penalty applied: -{deduction} pts for: {', '.join(penalty_reasons)}]"
        # Re-evaluate decision based on new score
        if result.fit_score < 50:
            result.decision = "reject"
        elif result.fit_score < 60:
            result.decision = "hold"

    if result.decision == "reject":
        return {
            "screening_result": result,
            "pipeline_status": "rejected",
            "rejection_reason": f"Screening score {result.fit_score}/100 — below threshold. {result.reasoning}",
            "log": [f"Screened: REJECT (score={result.fit_score})"]
        }
    
    if result.decision == "hold":
        return {
            "screening_result": result,
            "pipeline_status": "awaiting_human",
            "log": [f"Screened: HOLD (score={result.fit_score}) - Borderline candidate awaiting human review"]
        }

    if not state.get("enable_interviews", True):
        return {
            "screening_result": result,
            "pipeline_status": "shortlisted",
            "log": [f"Screened: ADVANCE (score={result.fit_score}) (Interviews Disabled - Auto Shortlisted)"]
        }

    return {
        "screening_result": result,
        "pipeline_status": "running",
        "log": [f"Screened: ADVANCE (score={result.fit_score})"]
    }
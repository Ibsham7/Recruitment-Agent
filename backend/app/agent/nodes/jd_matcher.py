import json
from app.agent.config import get_model
from app.agent.schemas import ScreeningResult
from app.agent.state import RecruitmentState
from app.agent.utils import extract_cost
from langchain_core.messages import HumanMessage, SystemMessage
from app.agent.prompts import JD_MATCHER_PROMPTS


async def jd_matcher_node(state: RecruitmentState) -> dict:
    """Score the candidate against the job description."""
    profile = state.get("candidate_profile")
    if profile is None:
        raise ValueError("candidate_profile is required for JD matching")

    print(f"\n[JD Matcher] Scoring: {profile.name}")

    jd = state["job_description"]
    
    # We put JD in the system prompt for effective prompt caching across candidates
    eval_mode = state.get("jd_matcher_prompt_variant") or "default"
    base_prompt = JD_MATCHER_PROMPTS.get(eval_mode, JD_MATCHER_PROMPTS["default"])
    system_prompt = base_prompt + f"\n\nJOB DESCRIPTION:\n{jd}"

    # Send the full structured profile, including raw_cv_text so the LLM can extract additional details
    profile_dict = profile.model_dump()
    
    max_retries = 3
    result = None
    cost = 0.0
    
    async def invoke_model(tier, system_prompt, human_content):
        m = get_model(tier, max_tokens=8000)
        sm = m.with_structured_output(ScreeningResult, method="json_schema", include_raw=True)
        for attempt in range(max_retries):
            try:
                response = await sm.ainvoke([
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=human_content)
                ])
                r = response["parsed"]
                c = extract_cost(response)
                
                # Compute weighted fit_score deterministicly
                weights = {
                    "default": {"skills": 0.50, "exp": 0.20, "nice": 0.15, "traj": 0.15},
                    "strict": {"skills": 0.65, "exp": 0.20, "nice": 0.10, "traj": 0.05},
                    "lenient": {"skills": 0.35, "exp": 0.15, "nice": 0.10, "traj": 0.40},
                }
                w = weights.get(eval_mode, weights["default"])
                calculated_score = (
                    r.score_breakdown.required_skills_score * w["skills"] +
                    r.score_breakdown.experience_score * w["exp"] +
                    r.score_breakdown.nice_to_have_score * w["nice"] +
                    r.score_breakdown.trajectory_score * w["traj"]
                )
                r.fit_score = round(calculated_score)
                
                def get_decision(score, mode):
                    if mode == "strict":
                        return "advance" if score >= 70 else "hold" if score >= 60 else "reject"
                    elif mode == "lenient":
                        return "advance" if score >= 55 else "hold" if score >= 40 else "reject"
                    else:
                        return "advance" if score >= 60 else "hold" if score >= 50 else "reject"
                
                r.decision = get_decision(r.fit_score, eval_mode)
                return r, c
            except Exception as e:
                print(f"  [JD Matcher] Attempt {attempt+1} failed: {e}. Raw response: {getattr(response, 'content', 'None') if 'response' in locals() else 'None'}")
                if attempt == max_retries - 1:
                    print(f"  [JD Matcher] All {max_retries} attempts failed. Falling back to HOLD.")
                    from app.agent.schemas import ScoreBreakdown
                    return ScreeningResult(
                        must_have=[],
                        nice_to_have=[],
                        experience_assessment="Fallback triggered due to consecutive LLM parsing failures.",
                        score_breakdown=ScoreBreakdown(required_skills_score=50, experience_score=50, nice_to_have_score=50, trajectory_score=50),
                        fit_score=50,
                        reasoning_summary=f"Error extracting structured evaluation from LLM after 3 retries: {str(e)}",
                        decision="hold"
                    ), 0.0
                    
    human_content = f"CANDIDATE PROFILE (JSON):\n{json.dumps(profile_dict, indent=2)}"
    result, cost = await invoke_model("fast", system_prompt, human_content)
    

    
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
        result.reasoning_summary += f" [Penalty applied: -{deduction} pts for: {', '.join(penalty_reasons)}]"
        # Re-evaluate decision based on new score
        if eval_mode == "strict":
            if result.fit_score < 60:
                result.decision = "reject"
            elif result.fit_score < 70:
                result.decision = "hold"
        elif eval_mode == "lenient":
            if result.fit_score < 40:
                result.decision = "reject"
            elif result.fit_score < 55:
                result.decision = "hold"
        else:
            if result.fit_score < 50:
                result.decision = "reject"
            elif result.fit_score < 60:
                result.decision = "hold"

    if result.decision == "reject":
        return {
            "screening_result": result,
            "pipeline_status": "rejected",
            "rejection_reason": f"Screening score {result.fit_score}/100 — below threshold. {result.reasoning_summary}",
            "log": [f"Screened: REJECT (score={result.fit_score})"],
            "total_cost": cost
        }
    
    if result.decision == "hold":
        return {
            "screening_result": result,
            "pipeline_status": "awaiting_human",
            "log": [f"Screened: HOLD (score={result.fit_score}) - Borderline candidate awaiting human review"],
            "total_cost": cost
        }

    if not state.get("enable_interviews", True):
        return {
            "screening_result": result,
            "pipeline_status": "shortlisted",
            "log": [f"Screened: ADVANCE (score={result.fit_score}) (Interviews Disabled - Auto Shortlisted)"],
            "total_cost": cost
        }

    return {
        "screening_result": result,
        "pipeline_status": "running",
        "log": [f"Screened: ADVANCE (score={result.fit_score})"],
        "total_cost": cost
    }
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
        m = get_model(tier, max_tokens=4000)
        sm = m.with_structured_output(ScreeningResult, method="json_schema", include_raw=True)
        for attempt in range(max_retries):
            try:
                response = await sm.ainvoke([
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=human_content)
                ])
                r = response["parsed"]
                c = extract_cost(response)
                
                return r, c
            except Exception as e:
                print(f"  [JD Matcher] Attempt {attempt+1} failed: {e}.")
                if attempt == max_retries - 1:
                    raise RuntimeError(f"Failed to evaluate candidate against JD after {max_retries} attempts: {e}")
                    
    human_content = f"CANDIDATE PROFILE (JSON):\n{json.dumps(profile_dict, indent=2)}"
    result, cost = await invoke_model("fast", system_prompt, human_content)
    
    # Calculate final weighted score, penalty deductions, and decision deterministically
    from app.agent.tools.scoring import calculate_weighted_fit_score
    penalties = state.get("penalties", [])
    final_score, decision, score_note = calculate_weighted_fit_score(
        result.score_breakdown,
        eval_mode=eval_mode,
        penalties=penalties
    )
    
    result.fit_score = final_score
    result.decision = decision
    if "Penalty applied" in score_note:
        result.reasoning_summary += f" [{score_note}]"

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
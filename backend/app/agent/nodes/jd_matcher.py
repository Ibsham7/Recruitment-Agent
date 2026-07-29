import json
from app.agent.config import get_model
from app.agent.schemas import ScreeningResult
from app.agent.state import RecruitmentState
from app.agent.utils import extract_cost, extract_json, clean_surrogates
from langchain_core.messages import HumanMessage, SystemMessage
from app.agent.prompts import JD_MATCHER_PROMPTS


async def jd_matcher_node(state: RecruitmentState) -> dict:
    """Score the candidate against the job description."""
    profile = state.get("candidate_profile")
    if profile is None:
        raise ValueError("candidate_profile is required for JD matching")

    print(f"\n[JD Matcher] Scoring: {profile.name}")

    jd = clean_surrogates(state["job_description"])
    
    # We put JD in the system prompt for effective prompt caching across candidates
    eval_mode = state.get("jd_matcher_prompt_variant") or "default"
    base_prompt = JD_MATCHER_PROMPTS.get(eval_mode, JD_MATCHER_PROMPTS["default"])
    system_prompt = base_prompt + f"\n\nJOB DESCRIPTION:\n{jd}"

    # Include profile dict with raw_cv_text capped at 2000 chars to ensure accurate scoring without token bloat
    profile_dict = profile.model_dump()
    raw_cv = clean_surrogates(profile_dict.get("raw_cv_text", ""))
    if len(raw_cv) > 2000:
        profile_dict["raw_cv_text"] = raw_cv[:2000] + "... [truncated]"
    else:
        profile_dict["raw_cv_text"] = raw_cv
    
    async def invoke_model(system_prompt, candidate_dict):
        model_escalation = [
            ("fast", 8192),
            ("fast", 8192),
            ("smart", 8192),
        ]
        human_content = clean_surrogates(f"CANDIDATE PROFILE (JSON):\n{json.dumps(candidate_dict, indent=2)}")
        
        for attempt, (tier, token_limit) in enumerate(model_escalation):
            try:
                attempt_prompt = system_prompt
                if attempt > 0:
                    attempt_prompt += "\n\nCRITICAL NOTICE: Keep your output extremely concise. Max 3 must_have items and brief 5-word evidence strings to ensure valid JSON output."
                
                m = get_model(tier, max_tokens=token_limit)
                sm = m.with_structured_output(ScreeningResult, method="json_schema", include_raw=True)
                
                try:
                    response = await sm.ainvoke([
                        SystemMessage(content=attempt_prompt),
                        HumanMessage(content=human_content)
                    ])
                    r = response.get("parsed") if isinstance(response, dict) else None
                    if not r and isinstance(response, dict):
                        raw_msg = response.get("raw")
                        raw_text = raw_msg.content if hasattr(raw_msg, "content") else (str(raw_msg) if raw_msg else None)
                        if raw_text:
                            extracted = extract_json(raw_text)
                            parsed_dict = json.loads(extracted)
                            r = ScreeningResult.model_validate(parsed_dict)
                    if r:
                        c = extract_cost(response)
                        return r, c
                except Exception as inner_e:
                    print(f"  [JD Matcher] Structured output attempt {attempt+1} ({tier}) failed ({inner_e}). Trying fallback raw JSON parsing...")
                    raw_resp = await m.ainvoke([
                        SystemMessage(content=attempt_prompt + "\nOutput a single valid JSON object matching the ScreeningResult schema."),
                        HumanMessage(content=human_content)
                    ])
                    extracted = extract_json(raw_resp.content)
                    parsed_dict = json.loads(extracted)
                    r = ScreeningResult.model_validate(parsed_dict)
                    c = extract_cost(raw_resp)
                    return r, c
            except Exception as e:
                print(f"  [JD Matcher] Attempt {attempt+1} ({tier}) failed: {e}.")
                if attempt == len(model_escalation) - 1:
                    raise RuntimeError(f"Failed to evaluate candidate against JD after {len(model_escalation)} attempts: {e}")
                    
    result, cost = await invoke_model(system_prompt, profile_dict)
    
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
        "pipeline_status": "shortlisted",
        "log": [f"Screened: ADVANCE (score={result.fit_score}) -> Shortlisted for Interview Invitation"],
        "total_cost": cost
    }
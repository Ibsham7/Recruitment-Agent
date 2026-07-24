from app.agent.state import RecruitmentState
import re

def extract_min_experience_from_jd(jd_text: str) -> float:
    """A naive regex to find 'X+ years' or 'X years' requirement in JD."""
    match = re.search(r'(\d+)\+?\s*years', jd_text, re.IGNORECASE)
    if match:
        return float(match.group(1))
    return 0.0

async def hard_filters_node(state: RecruitmentState) -> dict:
    """Zero LLM cost filter based on structured CV fields and explicit config."""
    print("\n[Hard Filters] Evaluating structured criteria...")
    profile = state.get("candidate_profile")
    jd = state.get("job_description", "")
    config = state.get("hard_filters_config", [])
    penalties = state.get("penalties", [])
    
    if not profile:
        return {"filter_rejections": ["No profile parsed."]}
    
    log = []
    
    if config:
        for rule in config:
            rule_type = rule.get("type")
            value = rule.get("value")
            penalty = rule.get("penalty", "reject")
            
            failed = False
            reason = ""
            
            if rule_type == "experience":
                min_exp = float(value)
                if profile.total_experience_years < min_exp:
                    failed = True
                    reason = f"Candidate has {profile.total_experience_years} years exp, but {min_exp} is required."
            elif rule_type == "skill":
                from app.agent.tools.skills import evaluate_mandatory_skills
                required_skills = [s.strip() for s in str(value).split(",") if s.strip()]
                all_passed, missing = evaluate_mandatory_skills(profile.skills, required_skills)
                if not all_passed:
                    failed = True
                    reason = f"Missing mandatory skill(s): {', '.join(missing)}"
            
            if failed:
                if penalty == "reject" or penalty == "completely_reject":
                    print(f"  [FAIL] Rejected: {reason}")
                    return {
                        "pipeline_status": "rejected",
                        "rejection_reason": reason,
                        "log": [f"Hard filter rejected: {reason}"]
                    }
                else:
                    print(f"  [PENALTY] {penalty}: {reason}")
                    penalties.append({"reason": reason, "severity": penalty})
                    log.append(f"Penalty applied ({penalty}): {reason}")
    else:
        # Fallback: Apply soft penalty for experience shortfall rather than hard-rejecting,
        # ensuring the LLM screener can evaluate transferable skills and penalize proportionally.
        min_exp = extract_min_experience_from_jd(jd)
        if min_exp > 0 and profile.total_experience_years < min_exp:
            shortfall = min_exp - profile.total_experience_years
            reason = f"Candidate has {profile.total_experience_years} years exp, but {min_exp} is required ({shortfall:.1f} yr shortfall)."
            print(f"  [PENALTY] Experience shortfall: {reason}")
            penalties.append({"reason": reason, "severity": "intermediate_penalize" if shortfall <= 2 else "hard_penalize"})
            log.append(f"Penalty applied for experience shortfall: {reason}")
            
    print("  [OK] Passed hard filters.")
    log.append("Passed hard filters checks.")
    return {
        "penalties": penalties,
        "log": log
    }


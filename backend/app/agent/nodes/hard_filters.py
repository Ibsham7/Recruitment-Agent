from app.agent.state import RecruitmentState
from app.core.logging import logger
import re

def extract_min_experience_from_jd(jd_text: str) -> float:
    """A naive regex to find 'X+ years' or 'X years' requirement in JD."""
    match = re.search(r'(\d+)\+?\s*years', jd_text, re.IGNORECASE)
    if match:
        return float(match.group(1))
    return 0.0

async def hard_filters_node(state: RecruitmentState) -> dict:
    """Zero LLM cost filter based on structured CV fields and explicit config."""
    logger.info("[Hard Filters] Evaluating structured criteria...")
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
                    logger.info(f"[Hard Filters] [FAIL] Rejected: {reason}")
                    return {
                        "pipeline_status": "rejected",
                        "rejection_reason": reason,
                        "log": [f"Hard filter rejected: {reason}"]
                    }
                else:
                    logger.info(f"[Hard Filters] [PENALTY] {penalty}: {reason}")
                    penalties.append({"reason": reason, "severity": penalty})
                    log.append(f"Penalty applied ({penalty}): {reason}")
    else:
        # Fallback: Experience tenure and shortfalls are evaluated proportionally within 
        # the downstream weighted scoring engine (experience_score) across all domains.
        # We avoid applying a secondary flat penalty here to prevent double-penalizing candidates.
        pass
            
    logger.info("[Hard Filters] [OK] Passed hard filters.")
    log.append("Passed hard filters checks.")
    return {
        "penalties": penalties,
        "log": log
    }


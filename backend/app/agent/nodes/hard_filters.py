from state import RecruitmentState
import re

def extract_min_experience_from_jd(jd_text: str) -> float:
    """A naive regex to find 'X+ years' or 'X years' requirement in JD."""
    match = re.search(r'(\d+)\+?\s*years', jd_text, re.IGNORECASE)
    if match:
        return float(match.group(1))
    return 0.0

def hard_filters_node(state: RecruitmentState) -> dict:
    """Zero LLM cost filter based on structured CV fields."""
    print("\n[Hard Filters] Evaluating structured criteria...")
    profile = state.get("candidate_profile")
    jd = state.get("job_description", "")
    
    if not profile:
        return {"pipeline_status": "rejected", "rejection_reason": "No profile parsed."}
    
    min_exp = extract_min_experience_from_jd(jd)
    
    if profile.total_experience_years < min_exp:
        reason = f"Candidate has {profile.total_experience_years} years exp, but {min_exp} is required."
        print(f"  [FAIL] Rejected: {reason}")
        return {
            "pipeline_status": "rejected",
            "rejection_reason": reason,
            "log": [f"Hard filter rejected: {reason}"]
        }
        
    print("  [OK] Passed hard filters.")
    return {
        "pipeline_status": "running",
        "log": ["Passed hard filters (experience checked)."]
    }

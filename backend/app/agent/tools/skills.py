import re
import difflib
from typing import List, Set, Tuple

def normalize_skill(skill: str) -> str:
    """Normalize skill string by lowering, stripping punctuation, and compressing spaces."""
    if not skill:
        return ""
    clean = str(skill).lower().strip()
    # Strip common variations like .js, .py, -
    clean = re.sub(r'[\.\-\_\/]', '', clean)
    clean = re.sub(r'\s+', ' ', clean)
    return clean

def is_skill_match(candidate_skill: str, required_skill: str, threshold: float = 0.85) -> bool:
    """
    Cross-industry skill matching logic.
    Works for Tech, Medical, Finance, Legal, Marketing, and general fields.
    """
    norm_cand = normalize_skill(candidate_skill)
    norm_req = normalize_skill(required_skill)
    
    if not norm_cand or not norm_req:
        return False
        
    # Exact or substring match
    if norm_req == norm_cand or norm_req in norm_cand or norm_cand in norm_req:
        return True
        
    # Fuzzy ratio match for minor spelling variations / industry terms
    ratio = difflib.SequenceMatcher(None, norm_cand, norm_req).ratio()
    if ratio >= threshold:
        return True
        
    return False

def evaluate_mandatory_skills(candidate_skills: List[str], required_skills: List[str]) -> Tuple[bool, List[str]]:
    """
    Check candidate's extracted skills against a list of required mandatory skills.
    Returns (all_passed, missing_skills_list).
    """
    if not required_skills:
        return True, []
        
    cand_norm_set = [normalize_skill(s) for s in candidate_skills]
    missing = []
    
    for req in required_skills:
        req_clean = req.strip()
        if not req_clean:
            continue
            
        matched = False
        for cand_s in candidate_skills:
            if is_skill_match(cand_s, req_clean):
                matched = True
                break
                
        if not matched:
            missing.append(req_clean)
            
    return len(missing) == 0, missing

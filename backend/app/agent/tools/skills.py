import re
import difflib
from typing import List, Set, Tuple

# Common numeronym pattern: first letter + digit(s) + last letter
# e.g., k8s → kubernetes, i18n → internationalization, a11y → accessibility
_NUMERONYM_RE = re.compile(r'^[a-zA-Z]\d+[a-zA-Z]$')


def _is_numeronym_match(a: str, b: str) -> bool:
    """
    Check if one string is a numeronym abbreviation of the other.
    Numeronyms are abbreviations like k8s (kubernetes), i18n (internationalization),
    a11y (accessibility) — first letter + digit count + last letter.
    """
    a_clean, b_clean = a.strip().lower(), b.strip().lower()
    if not a_clean or not b_clean:
        return False
    # Identify which is the numeronym and which is the full form
    if _NUMERONYM_RE.match(a_clean) and not _NUMERONYM_RE.match(b_clean):
        num, full = a_clean, b_clean
    elif _NUMERONYM_RE.match(b_clean) and not _NUMERONYM_RE.match(a_clean):
        num, full = b_clean, a_clean
    else:
        return False
    return full.startswith(num[0]) and full.endswith(num[-1])


def normalize_canonical_skill(skill: str) -> str:
    """
    Normalizes raw skill strings into standardized canonical concepts across domains.
    Handles British/American spelling variations (-ise -> -ize) and formatting.
    """
    if not skill:
        return ""
    clean = str(skill).strip()
    # 1. Spelling normalization (-ise -> -ize, -isation -> -ization, -ising -> -izing)
    clean = re.sub(r'(\w+)isation\b', r'\1ization', clean, flags=re.IGNORECASE)
    clean = re.sub(r'(\w+)ise\b', r'\1ize', clean, flags=re.IGNORECASE)
    clean = re.sub(r'(\w+)ising\b', r'\1izing', clean, flags=re.IGNORECASE)
    return clean


def normalize_skill(skill: str) -> str:
    """Normalize skill string by lowering, stripping punctuation/suffixes, and compressing spaces."""
    if not skill:
        return ""
    canonical = normalize_canonical_skill(skill)
    clean = canonical.lower().strip()
    # Strip common framework suffixes and syntax variations (.js, .py, -api, etc.)
    clean = re.sub(r'\.(?:js|ts|py|rb|go|rs|net)\b', '', clean)
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

    # Numeronym match (k8s ↔ kubernetes, i18n ↔ internationalization, a11y ↔ accessibility)
    if _is_numeronym_match(candidate_skill, required_skill):
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


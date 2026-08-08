import re
from typing import Set, List, Tuple, Optional, Any

GENERIC_BOILERPLATE_WORDS = {
    "experience", "knowledge", "skills", "proficient", "proficiency", "expertise",
    "strong", "demonstrated", "proven", "ability", "understanding", "familiarity",
    "working", "background", "track", "record", "minimum", "years", "yrs", "yr",
    "plus", "must", "have", "nice", "qualitative", "skill", "hands-on", "solid",
    "excellent", "good", "deep", "practical", "advanced", "basic", "fundamental",
    "preferred", "required", "requirement", "requirements", "candidate", "role",
    "with", "and", "or", "the", "a", "an", "in", "for", "of", "to", "at", "on",
    "by", "from", "as", "is", "are", "be", "been", "being", "including", "such",
    "development", "engineering", "management", "administration", "operations",
    "analysis", "services", "system", "systems", "platform", "platforms",
    "solution", "solutions", "processing", "practices", "methods", "framework",
    "frameworks", "tools", "tooling", "architecture", "design", "implementation",
    "maintenance", "integration", "strategy", "support", "containerization",
    "reporting", "standards", "compliance", "audit", "auditing", "process", "processes",
    "statement", "statements", "service", "level", "general", "specialist", "lead"
}

def extract_dynamic_requirement_tokens(requirement_name: str, jd_quote: str = "") -> Set[str]:
    """
    Dynamically extract substantive requirement tokens and alternatives from requirement name & quote
    without hardcoding any industry/domain terms.

    E.g. 'Pediatric ICU Nursing (or Emergency Trauma)' -> {'pediatric', 'icu', 'nursing', 'emergency', 'trauma'}
         'GAAP Accounting & IFRS Standards' -> {'gaap', 'accounting', 'ifrs'}
         'Containerization with Docker' -> {'containerization', 'docker'}
    """
    combined_text = f"{requirement_name or ''} {jd_quote or ''}".lower()
    if not combined_text.strip():
        return set()

    clean_tokens = set()

    # 1. Extract parenthetical and slashed alternatives (e.g. "(AWS / GCP)", "GAAP/IFRS", "(Pediatric/Trauma)")
    paren_matches = re.findall(r'\(([^)]+)\)', combined_text)
    for p_content in paren_matches:
        alts = [t.strip() for t in re.split(r'[/,|]|\b(?:or|and/or|and|e\.g\.|i\.e\.)\b', p_content, flags=re.IGNORECASE)]
        for alt in alts:
            alt_words = re.findall(r'[a-zA-Z0-9+#/\-]+', alt)
            for w in alt_words:
                w_clean = w.strip(" -/,.")
                if w_clean and len(w_clean) >= 2 and w_clean not in GENERIC_BOILERPLATE_WORDS:
                    clean_tokens.add(w_clean)

    # 2. Extract words from overall requirement text
    raw_words = re.findall(r'[a-zA-Z0-9+#/\-]+', combined_text)
    for word in raw_words:
        w_clean = word.strip(" -/,.")
        if w_clean and len(w_clean) >= 2 and w_clean not in GENERIC_BOILERPLATE_WORDS:
            clean_tokens.add(w_clean)

    # Fallback for generic requirements (e.g. 'Professional software engineering experience'):
    # If all tokens were filtered by boilerplate list, preserve substantive words (len >= 3)
    if not clean_tokens:
        stop_words = {"with", "and", "or", "the", "a", "an", "in", "for", "of", "to", "at", "on", "by", "from", "as", "is", "are", "be"}
        for word in raw_words:
            w_clean = word.strip(" -/,.")
            if w_clean and len(w_clean) >= 3 and w_clean not in stop_words:
                clean_tokens.add(w_clean)

    return clean_tokens

def check_dynamic_token_presence(req_tokens: Set[str], candidate_corpus: str) -> bool:
    """
    Check if at least one core substantive requirement token or root prefix is present
    in the candidate corpus (case-insensitive, word-bounded or root prefix matching).
    """
    if not req_tokens or not candidate_corpus:
        return False

    corpus_lower = candidate_corpus.lower()

    for token in req_tokens:
        # For short tokens (<= 3 chars e.g. 'aws', 'gcp', 'sql', 'icu', 'seo', 'rag', 'k8s'), use strict word boundary
        if len(token) <= 3 and not any(c in token for c in "+#/-."):
            pattern = rf"\b{re.escape(token)}\b"
            if re.search(pattern, corpus_lower):
                return True
        else:
            # Direct substring check
            if token in corpus_lower:
                return True

            # Morphological prefix check for tokens >= 5 chars (e.g. 'containeriz' for 'containerization'/'containerise')
            if len(token) >= 5:
                prefix = token[:5]
                if prefix in corpus_lower:
                    return True

    return False

def count_matching_tokens(req_tokens: Set[str], candidate_corpus: str) -> int:
    """Count how many requirement tokens are present in candidate corpus."""
    if not req_tokens or not candidate_corpus:
        return 0
    corpus_lower = candidate_corpus.lower()
    count = 0
    for token in req_tokens:
        if len(token) <= 3 and not any(c in token for c in "+#/-."):
            pattern = rf"\b{re.escape(token)}\b"
            if re.search(pattern, corpus_lower):
                count += 1
        else:
            if token in corpus_lower:
                count += 1
            elif len(token) >= 5 and token[:5] in corpus_lower:
                count += 1
    return count

SKILLS_LIST_PROSE_PATTERNS = [
    re.compile(r"\bskills?\s+(?:list|section|summary|bullet|includes?)\b", re.IGNORECASE),
    re.compile(r"\b(?:listed|found|included|mentioned)\b.*\b(?:skill|skills)\b", re.IGNORECASE),
    re.compile(r"\b(?:skill|skills)\b.*\b(?:listed|found|included|mentioned)\b", re.IGNORECASE),
    re.compile(r"listed\s+.*in\s+skills", re.IGNORECASE),
    re.compile(r"listed\s+['\"`]?\w+['\"`]?\s+as\s+a\s+skill", re.IGNORECASE),
]

SUBSTANTIVE_EXECUTION_VERBS = {
    "built", "shipped", "designed", "developed", "managed", "deployed", "authored",
    "led", "maintained", "implemented", "created", "rebuilt", "handled", "wrote",
    "delivered", "engineered", "architected", "launched", "operated", "cut", "reduced",
    "increased", "automated", "scaled", "owned", "pkg", "packaged"
}

def classify_evidence_source(
    req_name: str,
    jd_quote: str = "",
    candidate_profile: Optional[Any] = None,
    evidence_quote: str = ""
) -> str:
    """
    Deterministically classify the source of requirement evidence across any domain
    by comparing section-specific token match scores in candidate profile (roles vs projects vs education vs skills).

    Returns: 'employment' | 'project' | 'education' | 'skills_list_only' | 'inferred' | 'absent'
    """
    req_tokens = extract_dynamic_requirement_tokens(req_name, jd_quote)
    ev_lower = (evidence_quote or "").lower()

    if not candidate_profile:
        if any(pat.search(ev_lower) for pat in SKILLS_LIST_PROSE_PATTERNS) or "listed as a skill" in ev_lower or "skills list" in ev_lower:
            return "skills_list_only"
        if any(w in ev_lower for w in ["no evidence", "not mentioned", "absence of", "unmentioned"]):
            return "absent"
        return "employment"

    # Extract section-specific text from structured profile
    roles = getattr(candidate_profile, "previous_roles", []) or []
    roles_text_parts = []
    for r in roles:
        if isinstance(r, str):
            roles_text_parts.append(r)
        elif isinstance(r, dict):
            title = r.get("title", "")
            company = r.get("company", "")
            desc = r.get("description", "")
            skills_used = r.get("skills_used", []) or []
            roles_text_parts.append(f"{title} {company} {desc} {' '.join([str(s) for s in skills_used])}")
        else:
            title = getattr(r, "title", "")
            company = getattr(r, "company", "")
            desc = getattr(r, "description", "")
            skills_used = getattr(r, "skills_used", []) or []
            roles_text_parts.append(f"{title} {company} {desc} {' '.join([str(s) for s in skills_used])}")
    roles_text = " ".join(roles_text_parts).lower()

    projects = getattr(candidate_profile, "projects", []) or []
    achievements = getattr(candidate_profile, "key_achievements", []) or []
    projects_text_parts = []
    for p in projects:
        if isinstance(p, str):
            projects_text_parts.append(p)
        elif isinstance(p, dict):
            projects_text_parts.append(f"{p.get('title', '')} {p.get('name', '')} {p.get('description', '')}")
        else:
            p_t = getattr(p, "title", None) or getattr(p, "name", None) or str(p)
            p_d = getattr(p, "description", "")
            projects_text_parts.append(f"{p_t} {p_d}")
    for a in achievements:
        projects_text_parts.append(str(a))
    projects_text = " ".join(projects_text_parts).lower()

    education = getattr(candidate_profile, "education", []) or []
    edu_text_parts = []
    for e in education:
        if isinstance(e, str):
            edu_text_parts.append(e)
        elif isinstance(e, dict):
            edu_text_parts.append(f"{e.get('degree', '')} {e.get('institution', '')}")
        else:
            edu_text_parts.append(str(e))
    edu_text = " ".join(edu_text_parts).lower()

    skills = getattr(candidate_profile, "skills", []) or []
    skills_text = " ".join([str(s) for s in skills]).lower()

    raw_cv = str(getattr(candidate_profile, "raw_cv_text", "") or "").lower()

    # Check if evidence quote itself contains substantive execution language or matches role/project text
    has_substantive_verb = any(v in ev_lower for v in SUBSTANTIVE_EXECUTION_VERBS)
    matches_role = bool(ev_lower and (ev_lower in roles_text or any(w in roles_text for w in re.findall(r'\b[a-z]{4,}\b', ev_lower) if w not in {"with", "that", "this", "from", "using", "used", "role"})))
    matches_project = bool(ev_lower and (ev_lower in projects_text or any(w in projects_text for w in re.findall(r'\b[a-z]{4,}\b', ev_lower) if w not in {"with", "that", "this", "from", "using", "used", "role"})))

    if not req_tokens:
        if any(pat.search(ev_lower) for pat in SKILLS_LIST_PROSE_PATTERNS) or "listed as a skill" in ev_lower or "skills list" in ev_lower:
            return "skills_list_only"
        if has_substantive_verb or matches_role or roles_text:
            return "employment"
        return "employment"

    # Score each section by counting matching tokens
    roles_score = count_matching_tokens(req_tokens, roles_text)
    projects_score = count_matching_tokens(req_tokens, projects_text)
    edu_score = count_matching_tokens(req_tokens, edu_text)
    skills_score = count_matching_tokens(req_tokens, skills_text)
    raw_score = count_matching_tokens(req_tokens, raw_cv)

    # Boost education score if requirement specifically references degree/educational credentials
    EDU_INDICATOR_TERMS = {"degree", "bachelor", "bachelors", "master", "masters", "phd", "doctorate", "diploma", "education", "university", "college", "bs", "ms", "ba", "ma", "mba"}
    req_name_lower = (req_name or "").lower()
    if any(t in req_name_lower for t in EDU_INDICATOR_TERMS) and edu_score > 0:
        edu_score += 10

    max_score = max(roles_score, projects_score, edu_score, skills_score, raw_score)

    if max_score == 0:
        if any(pat.search(ev_lower) for pat in SKILLS_LIST_PROSE_PATTERNS) or "listed as a skill" in ev_lower or "skills list" in ev_lower:
            return "skills_list_only"
        if has_substantive_verb and matches_role:
            return "employment"
        if has_substantive_verb and matches_project:
            return "project"
        if any(w in ev_lower for w in ["no evidence", "not mentioned", "absence of", "unmentioned"]):
            return "absent"
        if ev_lower and len(ev_lower) >= 10 and not any(pat.search(ev_lower) for pat in SKILLS_LIST_PROSE_PATTERNS):
            return "employment"
        return "absent"

    # Select section with highest match count
    if edu_score == max_score and edu_score > 0:
        return "education"
    if roles_score == max_score and roles_score > 0:
        return "employment"
    if projects_score == max_score and projects_score > 0:
        return "project"
    if skills_score == max_score and skills_score > 0:
        # If tokens are also present in employment or projects, prioritize employment/project execution
        if roles_score > 0:
            return "employment"
        if projects_score > 0:
            return "project"
        return "skills_list_only"
    if raw_score == max_score and raw_score > 0:
        return "inferred"

    return "absent"


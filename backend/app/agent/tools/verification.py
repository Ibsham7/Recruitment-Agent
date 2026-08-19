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

# Minimal category → common instantiations mapping for deterministic bullet recovery.
# Only activated when requirement has NO parenthetical alternatives.
# Kept small and domain-neutral — covers high-frequency bare categories only.
CATEGORY_EXPANSIONS: dict[str, list[str]] = {
    "cloud": ["aws", "gcp", "azure", "terraform"],
    "ci/cd": ["jenkins", "github actions", "gitlab ci"],
    "container": ["docker", "kubernetes", "helm"],
    "database": ["postgresql", "mysql", "mongodb", "redis"],
}

SECTION_PRIORITY_WEIGHTS: dict[str, float] = {
    "employment": 1.5,
    "project": 1.2,
    "education": 1.0,
    "skills_list_only": 0.5,
    "inferred": 1.0,
    "absent": 0.0
}

def stem_token(token: str) -> str:
    """Lightweight morphological stemmer for domain and technical terms (e.g., deployed -> deploy, containerise/ization -> container)."""
    if not token or len(token) <= 3:
        return (token or "").lower()
    t = token.lower()
    if t.endswith("isation") or t.endswith("ization"):
        t = t[:-7] + "ize"
    elif t.endswith("ise") and len(t) > 4:
        t = t[:-3] + "ize"

    for suffix in ("ing", "ed", "ment", "ness", "ability", "ive", "s"):
        if t.endswith(suffix) and len(t) - len(suffix) >= 3:
            t = t[:-len(suffix)]
            break
    return t

def extract_dynamic_requirement_tokens(requirement_name: str, jd_quote: str = "") -> Set[str]:
    """
    Dynamically extract substantive requirement tokens, stems, and (conditionally)
    category expansions from requirement name & quote. Domain-agnostic.
    Category expansions only activate when the requirement contains no parenthetical alternatives.
    """
    combined_text = f"{requirement_name or ''} {jd_quote or ''}".lower()
    if not combined_text.strip():
        return set()

    clean_tokens = set()

    # Conditional category expansion — only if requirement has NO parenthetical alternatives
    has_parenthetical = bool(re.search(r'\([^)]+\)', combined_text))
    if not has_parenthetical:
        for cat_key, expansions in CATEGORY_EXPANSIONS.items():
            if cat_key in combined_text:
                for exp in expansions:
                    exp_clean = exp.lower().strip()
                    clean_tokens.add(exp_clean)
                    for w in re.findall(r'[a-zA-Z0-9+#/\-]+', exp_clean):
                        w_clean = w.strip(" -/,.")
                        if w_clean and len(w_clean) >= 2 and w_clean not in GENERIC_BOILERPLATE_WORDS:
                            clean_tokens.add(w_clean)
                            clean_tokens.add(stem_token(w_clean))

    # 1. Extract parenthetical alternatives (e.g., "(Jenkins, CircleCI, GitHub Actions)")
    paren_matches = re.findall(r'\(([^)]+)\)', combined_text)
    for p_content in paren_matches:
        alts = [t.strip() for t in re.split(r'[/,|]|\b(?:or|and/or|and|e\.g\.|i\.e\.)\b', p_content, flags=re.IGNORECASE)]
        for alt in alts:
            alt_words = re.findall(r'[a-zA-Z0-9+#/\-]+', alt)
            for w in alt_words:
                w_clean = w.strip(" -/,.")
                if w_clean and len(w_clean) >= 2 and w_clean not in GENERIC_BOILERPLATE_WORDS:
                    clean_tokens.add(w_clean)
                    clean_tokens.add(stem_token(w_clean))

    # 2. Extract slash-separated alternatives from main text (e.g., "PostgreSQL / MySQL")
    slash_groups = re.findall(r'(\b[a-zA-Z0-9+#\-]+(?:\s*/\s*[a-zA-Z0-9+#\-]+)+)', combined_text)
    for group in slash_groups:
        parts = [p.strip() for p in group.split('/')]
        for part in parts:
            if part and len(part) >= 2 and part not in GENERIC_BOILERPLATE_WORDS:
                clean_tokens.add(part)
                clean_tokens.add(stem_token(part))

    # 3. Extract all substantive words from requirement text
    raw_words = re.findall(r'[a-zA-Z0-9+#/\-]+', combined_text)
    for word in raw_words:
        w_clean = word.strip(" -/,.")
        if w_clean and len(w_clean) >= 2 and w_clean not in GENERIC_BOILERPLATE_WORDS:
            clean_tokens.add(w_clean)
            clean_tokens.add(stem_token(w_clean))

    # Fallback for generic requirements
    if not clean_tokens:
        stop_words = {"with", "and", "or", "the", "a", "an", "in", "for", "of", "to", "at", "on", "by", "from", "as", "is", "are", "be"}
        for word in raw_words:
            w_clean = word.strip(" -/,.")
            if w_clean and len(w_clean) >= 3 and w_clean not in stop_words:
                clean_tokens.add(w_clean)
                clean_tokens.add(stem_token(w_clean))

    return clean_tokens

def check_dynamic_token_presence(req_tokens: Set[str], candidate_corpus: str) -> bool:
    """
    Check if at least one core substantive requirement token, stem, or root prefix is present in candidate corpus.
    """
    if not req_tokens or not candidate_corpus:
        return False

    corpus_lower = candidate_corpus.lower()
    corpus_words = set(re.findall(r"\w+", corpus_lower))
    stemmed_corpus = {stem_token(w) for w in corpus_words}

    for token in req_tokens:
        token_stem = stem_token(token)
        if token_stem in stemmed_corpus:
            return True
        if len(token) <= 3 and not any(c in token for c in "+#/-."):
            pattern = rf"\b{re.escape(token)}\b"
            if re.search(pattern, corpus_lower):
                return True
        else:
            if token in corpus_lower:
                return True
            if len(token) >= 5 and token[:5] in corpus_lower:
                return True

    return False

def count_matching_tokens(req_tokens: Set[str], candidate_corpus: str) -> int:
    """Count how many requirement tokens or stemmed variants are present in candidate corpus."""
    if not req_tokens or not candidate_corpus:
        return 0
    corpus_lower = candidate_corpus.lower()
    corpus_words = set(re.findall(r"\w+", corpus_lower))
    stemmed_corpus = {stem_token(w) for w in corpus_words}
    count = 0
    for token in req_tokens:
        token_stem = stem_token(token)
        if token_stem in stemmed_corpus:
            count += 1
        elif len(token) <= 3 and not any(c in token for c in "+#/-."):
            pattern = rf"\b{re.escape(token)}\b"
            if re.search(pattern, corpus_lower):
                count += 1
        else:
            if token in corpus_lower:
                count += 1
            elif len(token) >= 5 and token[:5] in corpus_lower:
                count += 1
    return count

def normalize_text(text: str) -> str:
    """Normalize text by converting to lower case, removing quotes/punctuation, and compressing whitespace."""
    if not text:
        return ""
    t = str(text).lower()
    t = re.sub(r"[\"'`‘’‚‛“”„‟«»‹›]", "", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t

def _is_quote_in_text(q_norm: str, text_norm: str) -> bool:
    """
    Checks if a normalized evidence quote (or substantive snippet) is present in target text.
    Handles exact substring, whitespace-collapsed, and 3-4 word n-gram window matching.
    """
    if not q_norm or not text_norm:
        return False

    # 1. Direct substring match
    if q_norm in text_norm:
        return True

    # 2. Extract substantive words (len >= 2)
    words = [w for w in re.findall(r"\w+", q_norm) if len(w) >= 2]
    if not words:
        return False

    # 3. For multi-word quotes (>= 4 words), check if any 4-word window exists in target
    if len(words) >= 4:
        for i in range(len(words) - 3):
            window = " ".join(words[i:i+4])
            if window in text_norm:
                return True
        matches = sum(1 for w in words if w in text_norm)
        if matches / len(words) >= 0.75:
            return True
    else:
        # For 1-3 words, check if all substantive words are present
        if all(w in text_norm for w in words):
            return True

    return False

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
    req_name: str = "",
    jd_quote: str = "",
    candidate_profile: Optional[Any] = None,
    evidence_quote: str = ""
) -> str:
    """
    Deterministically classify the source of requirement evidence across any domain
    by verifying the verbatim candidate evidence quote against structural sections of the candidate profile
    (employment history vs projects vs skills list vs education).

    Returns: 'employment' | 'project' | 'education' | 'skills_list_only' | 'inferred' | 'absent'
    """
    ev_raw = (evidence_quote or "").strip()
    ev_lower = ev_raw.lower()

    if not ev_raw:
        return "absent"

    if any(w in ev_lower for w in ["no evidence", "no direct evidence", "not mentioned", "absence of", "unmentioned"]):
        return "absent"

    if not candidate_profile:
        if any(pat.search(ev_lower) for pat in SKILLS_LIST_PROSE_PATTERNS) or "listed as a skill" in ev_lower or "skills list" in ev_lower:
            return "skills_list_only"
        return "employment"

    q_norm = normalize_text(ev_raw)

    # 1. Extract and normalize structural sections from profile
    roles = getattr(candidate_profile, "previous_roles", []) or []
    roles_parts = []
    for r in roles:
        if isinstance(r, str):
            roles_parts.append(r)
        elif isinstance(r, dict):
            title = r.get("title", "")
            company = r.get("company", "")
            desc = r.get("description", "")
            skills_used = " ".join([str(s) for s in (r.get("skills_used", []) or [])])
            roles_parts.append(f"{title} {company} {desc} {skills_used}")
        else:
            title = getattr(r, "title", "")
            company = getattr(r, "company", "")
            desc = getattr(r, "description", "")
            skills_used = " ".join([str(s) for s in (getattr(r, "skills_used", []) or [])])
            roles_parts.append(f"{title} {company} {desc} {skills_used}")
    roles_norm = normalize_text(" ".join(roles_parts))

    projects = getattr(candidate_profile, "projects", []) or []
    achievements = getattr(candidate_profile, "key_achievements", []) or []
    proj_parts = []
    for p in projects:
        if isinstance(p, str):
            proj_parts.append(p)
        elif isinstance(p, dict):
            proj_parts.append(f"{p.get('title', '')} {p.get('name', '')} {p.get('description', '')}")
        else:
            p_t = getattr(p, "title", None) or getattr(p, "name", None) or str(p)
            p_d = getattr(p, "description", "")
            proj_parts.append(f"{p_t} {p_d}")
    for a in achievements:
        proj_parts.append(str(a))
    projects_norm = normalize_text(" ".join(proj_parts))

    skills = getattr(candidate_profile, "skills", []) or []
    skills_norm = normalize_text(" ".join([str(s) for s in skills]))

    education = getattr(candidate_profile, "education", []) or []
    edu_parts = []
    for e in education:
        if isinstance(e, str):
            edu_parts.append(e)
        elif isinstance(e, dict):
            edu_parts.append(f"{e.get('degree', '')} {e.get('institution', '')}")
        else:
            edu_parts.append(str(e))
    edu_norm = normalize_text(" ".join(edu_parts))

    raw_cv = str(getattr(candidate_profile, "raw_cv_text", "") or "")
    raw_cv_norm = normalize_text(raw_cv)

    # 2. Check quote presence across structural sections
    in_roles = _is_quote_in_text(q_norm, roles_norm)
    in_projects = _is_quote_in_text(q_norm, projects_norm)
    in_edu = _is_quote_in_text(q_norm, edu_norm)
    in_skills = _is_quote_in_text(q_norm, skills_norm)
    in_raw = _is_quote_in_text(q_norm, raw_cv_norm)

    is_skills_prose = any(pat.search(ev_lower) for pat in SKILLS_LIST_PROSE_PATTERNS) or "listed as a skill" in ev_lower or "skills list" in ev_lower

    if in_roles:
        return "employment"
    if in_projects:
        return "project"
    if in_edu:
        return "education"
    if in_skills or is_skills_prose:
        return "skills_list_only"
    if in_raw:
        return "inferred"

    # If quote is not found in CV text at all, check if requirement name itself is in roles/projects/skills
    req_clean = normalize_text(req_name)
    if req_clean and _is_quote_in_text(req_clean, roles_norm):
        return "employment"
    if req_clean and _is_quote_in_text(req_clean, projects_norm):
        return "project"
    if req_clean and _is_quote_in_text(req_clean, skills_norm):
        return "skills_list_only"

    return "absent"



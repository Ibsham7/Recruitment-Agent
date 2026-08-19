"""
Deterministic 3-Branch Reduction Engine — Claim-Aware Scoring Architecture.

Converts (source, depth, scope) evaluations into deterministic match verdicts:
- Branch A (Proven): Evidence bullets present → map via REDUCTION table with hedge downgrade.
- Branch B (Claim-Only): No bullets, but declared in skills / alias match → partial + claim_only flag.
- Branch C (Absent): No bullets, not declared → none + absent flag.
"""

import logging
import re
from typing import Optional, Any

logger = logging.getLogger(__name__)

# ─── Lookup Tables & Constants ──────────────────────────────────────────────────

REDUCTION: dict[tuple[str, str], tuple[str, str, str]] = {
    #                                        exact      adjacent   unrelated
    ("employment", "owned"):                ("full",    "partial", "none"),
    ("employment", "used"):                 ("full",    "partial", "none"),
    ("employment", "assisted"):             ("partial", "partial", "none"),
    ("employment", "learning"):             ("partial", "none",    "none"),
    ("employment", "named_only"):           ("partial", "none",    "none"),
    ("project_work", "owned"):              ("full",    "partial", "none"),
    ("project_work", "used"):               ("full",    "partial", "none"),
    ("project_work", "assisted"):           ("partial", "none",    "none"),
    ("project_work", "learning"):           ("partial", "none",    "none"),
    ("project_work", "named_only"):         ("partial", "none",    "none"),
    ("project_personal", "owned"):          ("partial", "none",    "none"),
    ("project_personal", "used"):           ("partial", "none",    "none"),
    ("project_personal", "assisted"):       ("partial", "none",    "none"),
    ("project_personal", "learning"):       ("partial", "none",    "none"),
    ("project_personal", "named_only"):     ("partial", "none",    "none"),
    ("summary", "owned"):                   ("partial", "none",    "none"),
    ("summary", "used"):                    ("partial", "none",    "none"),
    ("summary", "assisted"):                ("partial", "none",    "none"),
    ("summary", "learning"):                ("partial", "none",    "none"),
    ("summary", "named_only"):              ("partial", "none",    "none"),
    ("education", "owned"):                 ("partial", "none",    "none"),
    ("education", "used"):                  ("partial", "none",    "none"),
    ("education", "assisted"):              ("partial", "none",    "none"),
    ("education", "learning"):              ("partial", "none",    "none"),
    ("education", "named_only"):            ("partial", "none",    "none"),
    ("certification", "owned"):             ("partial", "none",    "none"),
    ("certification", "used"):              ("partial", "none",    "none"),
    ("certification", "assisted"):          ("partial", "none",    "none"),
    ("certification", "learning"):          ("partial", "none",    "none"),
    ("certification", "named_only"):        ("partial", "none",    "none"),
}

SOURCE_RANK: dict[str, int] = {
    "employment": 5,
    "project_work": 4,
    "project_personal": 3,
    "certification": 2,
    "education": 2,
    "summary": 1,
}

SCOPE_IDX: dict[str, int] = {"exact": 0, "adjacent": 1, "unrelated": 2}

ORD_DEPTH: dict[str, int] = {
    "owned": 5,
    "used": 4,
    "assisted": 3,
    "learning": 2,
    "named_only": 1,
}

HEDGE_RE = re.compile(
    r'\b(assisted|helped|supported|contributed to|participated in|exposure to|familiar with|'
    r'basic knowledge|some experience|learning|studied)\b',
    re.IGNORECASE
)

def _normalize_for_matching(text: str) -> str:
    """Strip common suffixes and syntax for matching."""
    t = text.lower().strip()
    # Strip framework/file suffixes
    t = re.sub(r'\.(?:js|ts|py|rb|go|rs|net)\b', '', t)
    t = re.sub(r'(?<=[a-z])js\b', '', t)
    # Strip common qualifiers
    t = re.sub(r'\b(?:pipelines?|workflows?|services?)\b', '', t)
    t = re.sub(r'[-_./]', ' ', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t


def _is_acronym_match(acronym: str, full_phrase: str) -> bool:
    """
    Conservative acronym matching: checks if an uppercase token (≥2 chars)
    matches the first letters of a multi-word phrase, or a known numeronym.
    """
    acr = acronym.strip()
    if len(acr) < 2 or len(acr) > 6:
        return False

    # Handle k8s/i18n-style numeronyms: first letter + digit(s) + last letter
    if re.match(r'^[a-zA-Z]\d+[a-zA-Z]$', acr):
        first, last = acr[0].lower(), acr[-1].lower()
        phrase_lower = full_phrase.lower().strip()
        return phrase_lower.startswith(first) and phrase_lower.endswith(last)

    # Standard first-letter acronym matching: requires uppercase
    if not acr.isupper():
        return False

    words = [w for w in re.findall(r'[a-zA-Z]+', full_phrase) if len(w) >= 2]
    if len(words) != len(acr):
        return False

    return all(w[0].upper() == c for w, c in zip(words, acr))


def classify_bullet_source(bullet_id: str) -> str:
    """Classify bullet's source type based on its ID prefix."""
    bid = (bullet_id or "").upper().strip()
    if bid.startswith("E") or bid.startswith("A"):
        return "employment"
    elif bid.startswith("P"):
        return "project_work"
    elif bid.startswith("SU"):
        return "summary"
    elif bid.startswith("ED"):
        return "education"
    elif bid.startswith("C"):
        return "certification"
    return "employment"


def is_skill_grounded_in_declared(requirement_name: str, skills_declared: list[str]) -> bool:
    """
    Domain-agnostic check: does the requirement match any declared skill
    via normalized token matching, substring matching, word-boundary intersection, or acronym resolution?

    Replaces the former alias_hit() + SKILL_ALIASES dictionary.
    """
    if not requirement_name or not skills_declared:
        return False
    req_norm = _normalize_for_matching(requirement_name)
    req_words = set(re.findall(r'\w+', req_norm))
    for raw_skill in skills_declared:
        if not raw_skill:
            continue
        skill_str = str(raw_skill).strip()
        skill_norm = _normalize_for_matching(skill_str)
        # 1. Exact or word-boundary match (prevents raw substring match like 'java' in 'javascript')
        if skill_norm == req_norm:
            return True
        if re.search(rf'\b{re.escape(skill_norm)}\b', req_norm) or re.search(rf'\b{re.escape(req_norm)}\b', skill_norm):
            return True
        # 2. Word intersection match — use word boundaries to prevent java/javascript false positive
        if any(re.search(rf'\b{re.escape(w)}\b', skill_norm) for w in req_words if len(w) >= 3):
            return True
        skill_words = set(re.findall(r'\w+', skill_norm))
        if any(re.search(rf'\b{re.escape(w)}\b', req_norm) for w in skill_words if len(w) >= 3):
            return True
        # 3. Acronym matching (both directions)
        # Requirement is acronym, skill is full phrase (e.g., req="NLP", skill="Natural Language Processing")
        req_stripped = requirement_name.strip()
        if _is_acronym_match(req_stripped, skill_str):
            return True
        # Skill is acronym, requirement is full phrase (e.g., skill="NLP", req="Natural Language Processing")
        if _is_acronym_match(skill_str, req_stripped):
            return True
    return False


def build_bullet_index(candidate_profile: Any) -> dict[str, dict]:
    """Build a lookup index of all bullets by ID from candidate_profile."""
    index = {}

    if isinstance(candidate_profile, dict):
        roles = candidate_profile.get("previous_roles", []) or []
        projects = candidate_profile.get("projects", []) or []
    else:
        roles = getattr(candidate_profile, "previous_roles", []) or []
        projects = getattr(candidate_profile, "projects", []) or []

    role_idx = 1
    for role in roles:
        if isinstance(role, dict):
            r_id = role.get("id") or f"E{role_idx}"
            bullets = role.get("bullets", []) or []
            desc = role.get("description", "")
        else:
            r_id = getattr(role, "id", None) or f"E{role_idx}"
            bullets = getattr(role, "bullets", []) or []
            desc = getattr(role, "description", "")
        role_idx += 1

        b_idx = 1
        for bullet in bullets:
            if isinstance(bullet, dict):
                b_id = bullet.get("id") or bullet.get("bullet_id") or f"{r_id}.{b_idx}"
                b_text = bullet.get("text", "")
            else:
                b_id = getattr(bullet, "id", None) or getattr(bullet, "bullet_id", None) or f"{r_id}.{b_idx}"
                b_text = getattr(bullet, "text", "")
            b_idx += 1
            if b_id and b_text:
                index[b_id] = {"id": b_id, "text": b_text, "source": classify_bullet_source(b_id)}

        # Also index description lines if bullets list is empty
        if not bullets and desc:
            lines = [line.strip(" •-*") for line in str(desc).splitlines() if line.strip(" •-*")]
            for l_i, line in enumerate(lines, 1):
                fallback_id = f"{r_id}.{l_i}"
                if fallback_id not in index:
                    index[fallback_id] = {"id": fallback_id, "text": line, "source": classify_bullet_source(fallback_id)}

    proj_idx = 1
    for proj in projects:
        if isinstance(proj, dict):
            p_id = proj.get("id") or f"P{proj_idx}"
            bullets = proj.get("bullets", []) or []
            desc = proj.get("description", "")
        else:
            p_id = getattr(proj, "id", None) or f"P{proj_idx}"
            bullets = getattr(proj, "bullets", []) or []
            desc = getattr(proj, "description", "")
        proj_idx += 1

        b_idx = 1
        for bullet in bullets:
            if isinstance(bullet, dict):
                b_id = bullet.get("id") or bullet.get("bullet_id") or f"{p_id}.{b_idx}"
                b_text = bullet.get("text", "")
            else:
                b_id = getattr(bullet, "id", None) or getattr(bullet, "bullet_id", None) or f"{p_id}.{b_idx}"
                b_text = getattr(bullet, "text", "")
            b_idx += 1
            if b_id and b_text:
                index[b_id] = {"id": b_id, "text": b_text, "source": classify_bullet_source(b_id)}

        if not bullets and desc:
            lines = [line.strip(" •-*") for line in str(desc).splitlines() if line.strip(" •-*")]
            for l_i, line in enumerate(lines, 1):
                fallback_id = f"{p_id}.{l_i}"
                if fallback_id not in index:
                    index[fallback_id] = {"id": fallback_id, "text": line, "source": classify_bullet_source(fallback_id)}

    # Index key achievements as employment bullets
    achievements = []
    if isinstance(candidate_profile, dict):
        achievements = candidate_profile.get("key_achievements", []) or []
    else:
        achievements = getattr(candidate_profile, "key_achievements", []) or []

    for a_idx, ach in enumerate(achievements, 1):
        a_text = str(ach).strip() if ach else ""
        if a_text:
            a_id = f"A{a_idx}"
            index[a_id] = {"id": a_id, "text": a_text, "source": "employment"}

    return index


def reduce_match(
    requirement_name: str,
    evidence_bullet_ids: list[str],
    scope: Optional[str],
    depth: Optional[str],
    declared_in_skills: bool,
    candidate_profile: Any,
    evidence_quote: Optional[str] = None,
) -> tuple[str, Optional[str]]:
    """
    Deterministic 3-Branch Reduction Engine.

    Returns: (verdict: "full" | "partial" | "none", flag: Optional[str])
    """
    bullet_index = build_bullet_index(candidate_profile)
    valid_bullet_ids = [bid for bid in (evidence_bullet_ids or []) if bid in bullet_index]

    # Deterministic bullet recovery: if LLM omitted bullet IDs, search profile bullets for requirement tokens
    if not valid_bullet_ids and requirement_name:
        from app.agent.tools.verification import extract_dynamic_requirement_tokens, check_dynamic_token_presence
        req_tokens = extract_dynamic_requirement_tokens(requirement_name)
        if req_tokens:
            for b_id, b_info in bullet_index.items():
                b_text = b_info.get("text", "")
                if check_dynamic_token_presence(req_tokens, b_text):
                    valid_bullet_ids.append(b_id)

    # Grounding check: Check if evidence_quote is present in work/project history
    ev_quote_clean = (evidence_quote or "").strip().lower()
    has_substantive_quote = bool(
        ev_quote_clean and 
        len(ev_quote_clean) >= 10 and 
        "declared in skills" not in ev_quote_clean and 
        "no evidence" not in ev_quote_clean and
        "skills section" not in ev_quote_clean
    )

    # Gather experience & project text corpus from candidate_profile
    if isinstance(candidate_profile, dict):
        roles = candidate_profile.get("previous_roles", []) or []
        projects = candidate_profile.get("projects", []) or []
        raw_cv = str(candidate_profile.get("raw_cv_text", "") or "").lower()
    else:
        roles = getattr(candidate_profile, "previous_roles", []) or []
        projects = getattr(candidate_profile, "projects", []) or []
        raw_cv = str(getattr(candidate_profile, "raw_cv_text", "") or "").lower()

    exp_text_parts = []
    for r in roles:
        if isinstance(r, dict):
            exp_text_parts.append(str(r.get("title", "")) + " " + str(r.get("description", "")) + " " + " ".join([str(s) for s in (r.get("skills_used", []) or [])]))
            for b in (r.get("bullets", []) or []):
                b_txt = b.get("text", "") if isinstance(b, dict) else getattr(b, "text", "")
                exp_text_parts.append(b_txt)
        else:
            exp_text_parts.append(str(getattr(r, "title", "")) + " " + str(getattr(r, "description", "")) + " " + " ".join([str(s) for s in (getattr(r, "skills_used", []) or [])]))
            for b in (getattr(r, "bullets", []) or []):
                b_txt = b.get("text", "") if isinstance(b, dict) else getattr(b, "text", "")
                exp_text_parts.append(b_txt)

    for p in projects:
        if isinstance(p, dict):
            exp_text_parts.append(str(p.get("title", "")) + " " + str(p.get("description", "")))
        else:
            exp_text_parts.append(str(getattr(p, "title", "")) + " " + str(getattr(p, "description", "")))

    exp_corpus = " ".join(exp_text_parts).lower()

    # Check if quote or requirement tokens exist in work/project history
    quote_in_exp = False
    if has_substantive_quote and exp_corpus.strip():
        snippet = ev_quote_clean[:30].strip()
        if snippet and snippet in exp_corpus:
            quote_in_exp = True
        else:
            quote_words = [w for w in re.findall(r'\w+', ev_quote_clean) if len(w) >= 4]
            if quote_words and sum(1 for w in quote_words if w in exp_corpus) / len(quote_words) >= 0.5:
                quote_in_exp = True

    # Branch A: Proven — evidence bullets exist OR evidence quote is grounded in work/project history
    if valid_bullet_ids or quote_in_exp:
        if valid_bullet_ids:
            bullets = [bullet_index[bid] for bid in valid_bullet_ids]
            best_bullet = max(bullets, key=lambda b: SOURCE_RANK.get(b["source"], 0))
            best_source = best_bullet["source"]
            combined_bullet_text = " ".join(b["text"] for b in bullets).lower()
        else:
            best_source = "employment"
            combined_bullet_text = ev_quote_clean

        eff_depth = depth or "used"
        if eff_depth not in ORD_DEPTH:
            eff_depth = "used"

        if HEDGE_RE.search(combined_bullet_text) and ORD_DEPTH.get(eff_depth, 0) > ORD_DEPTH["assisted"]:
            eff_depth = "assisted"
            logger.info(f"Hedge downgrade applied for {requirement_name}: {depth} → assisted")

        eff_scope = scope or "exact"
        if eff_scope not in SCOPE_IDX:
            eff_scope = "exact"

        reduction_key = (best_source, eff_depth)
        if reduction_key not in REDUCTION:
            reduction_key = (best_source, "named_only")

        scope_idx = SCOPE_IDX[eff_scope]
        verdict = REDUCTION[reduction_key][scope_idx]
        return verdict, None

    # Branch B: Claim-Only — no evidence in work/projects, but skill is declared in skills section
    skills_declared = []
    if isinstance(candidate_profile, dict):
        skills_declared = candidate_profile.get("skills_declared", []) or candidate_profile.get("skills", []) or []
    else:
        skills_declared = getattr(candidate_profile, "skills_declared", []) or getattr(candidate_profile, "skills", []) or []

    skills_decl_lower = [str(s).lower().strip() for s in skills_declared if s]
    ev_in_skills = bool(
        ev_quote_clean and any(
            s in ev_quote_clean or ev_quote_clean in s
            for s in skills_decl_lower if len(s) >= 2
        )
    )

    if declared_in_skills or is_skill_grounded_in_declared(requirement_name, skills_declared) or ev_in_skills:
        return "partial", "claim_only"

    # Branch C: Absent — no bullet evidence, not declared in skills
    return "none", "absent"


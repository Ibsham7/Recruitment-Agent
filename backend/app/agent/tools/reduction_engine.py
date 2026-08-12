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

SKILL_ALIASES: dict[str, list[str]] = {
    "python": ["python3", "python 3", "cpython"],
    "javascript": ["js", "ecmascript", "es6", "es2015"],
    "typescript": ["ts"],
    "react": ["reactjs", "react.js", "react js"],
    "node": ["nodejs", "node.js", "node js"],
    "postgresql": ["postgres", "psql", "pg"],
    "mongodb": ["mongo"],
    "docker": ["docker container", "containerization", "dockerfile"],
    "kubernetes": ["k8s", "kube"],
    "aws": ["amazon web services", "amazon aws", "ecs", "fargate", "lambda", "ec2", "s3", "rds"],
    "azure": ["microsoft azure", "ms azure"],
    "gcp": ["google cloud", "google cloud platform"],
    "ci/cd": ["cicd", "ci cd", "continuous integration", "continuous deployment", "continuous delivery", "github actions"],
    "fastapi": ["fast api", "fast-api"],
    "django": ["django rest framework", "drf"],
    "flask": ["flask api"],
    "terraform": ["tf", "hashicorp terraform"],
    "redis": ["redis cache", "redis db"],
    "mysql": ["mariadb"],
    "graphql": ["graph ql"],
    "rest api": ["restful", "rest apis", "restful api", "rest api"],
    "machine learning": ["ml", "machine-learning"],
    "deep learning": ["dl", "deep-learning"],
    "natural language processing": ["nlp"],
    "computer vision": ["cv", "image recognition"],
}


def classify_bullet_source(bullet_id: str) -> str:
    """Classify bullet's source type based on its ID prefix."""
    bid = (bullet_id or "").upper().strip()
    if bid.startswith("E"):
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


def alias_hit(requirement_text: str, skills_declared: list[str]) -> bool:
    """
    Deterministic backstop: check if requirement matches any declared skill via alias map.
    Only turns 'none' into 'partial'.
    """
    if not requirement_text or not skills_declared:
        return False

    req_lower = requirement_text.lower()
    skills_lower = {str(s).lower().strip() for s in skills_declared if s}

    # Direct substring check first
    req_words = set(re.findall(r'\w+', req_lower))
    for skill in skills_lower:
        if skill in req_lower or any(w in skill for w in req_words if len(w) >= 3):
            return True

    # Alias check
    for canonical, aliases in SKILL_ALIASES.items():
        all_forms = [canonical] + aliases
        req_matches = any(form in req_lower for form in all_forms)
        if req_matches:
            skill_matches = any(
                any(form in skill for form in all_forms)
                for skill in skills_lower
            )
            if skill_matches:
                return True

    return False


def build_bullet_index(candidate_profile: Any) -> dict[str, dict]:
    """Build a lookup index of all bullets by ID from candidate_profile."""
    index = {}

    roles = getattr(candidate_profile, "previous_roles", []) or []
    for role in roles:
        bullets = getattr(role, "bullets", []) or []
        for bullet in bullets:
            b_id = getattr(bullet, "id", None) or getattr(bullet, "bullet_id", None)
            b_text = getattr(bullet, "text", "")
            if b_id and b_text:
                index[b_id] = {"id": b_id, "text": b_text, "source": classify_bullet_source(b_id)}

    projects = getattr(candidate_profile, "projects", []) or []
    for proj in projects:
        if isinstance(proj, dict):
            bullets = proj.get("bullets", [])
        else:
            bullets = getattr(proj, "bullets", []) or []
        for bullet in bullets:
            if isinstance(bullet, dict):
                b_id = bullet.get("id")
                b_text = bullet.get("text", "")
            else:
                b_id = getattr(bullet, "id", None)
                b_text = getattr(bullet, "text", "")
            if b_id and b_text:
                index[b_id] = {"id": b_id, "text": b_text, "source": classify_bullet_source(b_id)}

    return index


def reduce_match(
    requirement_name: str,
    evidence_bullet_ids: list[str],
    scope: Optional[str],
    depth: Optional[str],
    declared_in_skills: bool,
    candidate_profile: Any,
) -> tuple[str, Optional[str]]:
    """
    Deterministic 3-Branch Reduction Engine.

    Returns: (verdict: "full" | "partial" | "none", flag: Optional[str])
    """
    bullet_index = build_bullet_index(candidate_profile)
    valid_bullet_ids = [bid for bid in (evidence_bullet_ids or []) if bid in bullet_index]

    # Branch A: Proven — evidence bullets exist
    if valid_bullet_ids:
        bullets = [bullet_index[bid] for bid in valid_bullet_ids]
        best_bullet = max(bullets, key=lambda b: SOURCE_RANK.get(b["source"], 0))
        best_source = best_bullet["source"]

        eff_depth = depth or "used"
        if eff_depth not in ORD_DEPTH:
            eff_depth = "used"

        # Apply hedge downgrade if hedging language is in the cited bullet text
        combined_bullet_text = " ".join(b["text"] for b in bullets).lower()
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

    # Branch B: Claim-Only — no bullets, but skill is declared in skills section
    skills_declared = getattr(candidate_profile, "skills_declared", []) or getattr(candidate_profile, "skills", []) or []
    if declared_in_skills or alias_hit(requirement_name, skills_declared):
        return "partial", "claim_only"

    # Branch C: Absent — no bullet evidence, not declared in skills
    return "none", "absent"

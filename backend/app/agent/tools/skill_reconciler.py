"""
Read-Only Skill Reconciler — UI & Search Artifact.

Extracts proven skills vs. claimed-only skills from candidate profiles.
This module is READ-ONLY for candidate dashboards and pool-wide talent search.
It NEVER influences candidate fit scores or screening decisions.
"""

import re
from typing import Any, NamedTuple


class ReconciledSkill(NamedTuple):
    skill_name: str
    status: str  # "proven" | "named_only" | "claimed_only"
    max_depth: str  # "owned" | "used" | "assisted" | "learning" | "none"
    bullet_ids: list[str]


CANONICAL_TECH_TAXONOMY = {
    "python", "javascript", "typescript", "java", "c++", "c#", "go", "golang", "rust",
    "fastapi", "django", "flask", "express", "react", "vue", "angular", "node", "nodejs",
    "postgresql", "postgres", "mysql", "mongodb", "redis", "elasticsearch", "sqlite",
    "docker", "kubernetes", "k8s", "helm", "terraform", "ansible", "aws", "azure", "gcp",
    "ci/cd", "github actions", "jenkins", "celery", "kafka", "rabbitmq", "graphql", "rest api",
    "machine learning", "deep learning", "nlp", "pytorch", "tensorflow", "scikit-learn"
}


def reconcile_candidate_skills(candidate_profile: Any) -> dict[str, Any]:
    """
    Reconciles declared skills against work experience and project bullets.

    Returns a dict with:
    - proven_skills: list[ReconciledSkill]
    - claimed_only_skills: list[ReconciledSkill]
    - depth_summary: dict (e.g. {"proven": 6, "named_only": 4, "claimed_only": 5})
    """
    skills_declared = getattr(candidate_profile, "skills_declared", []) or getattr(candidate_profile, "skills", []) or []
    roles = getattr(candidate_profile, "previous_roles", []) or []

    # Build bullet map
    bullet_map = {}
    for role in roles:
        bullets = getattr(role, "bullets", []) or []
        for b in bullets:
            b_id = getattr(b, "id", None)
            b_text = getattr(b, "text", "")
            if b_id and b_text:
                bullet_map[b_id] = b_text.lower()

    proven_skills = []
    claimed_only_skills = []

    for skill in skills_declared:
        s_clean = skill.strip()
        s_lower = s_clean.lower()

        # Word boundary pattern match
        pattern = rf"\b{re.escape(s_lower)}\b" if not any(c in s_lower for c in "+#/-.") else re.escape(s_lower)
        matching_bids = [bid for bid, btext in bullet_map.items() if re.search(pattern, btext)]

        if matching_bids:
            proven_skills.append(ReconciledSkill(
                skill_name=s_clean,
                status="proven",
                max_depth="used",
                bullet_ids=matching_bids
            ))
        else:
            claimed_only_skills.append(ReconciledSkill(
                skill_name=s_clean,
                status="claimed_only",
                max_depth="none",
                bullet_ids=[]
            ))

    depth_summary = {
        "proven": len(proven_skills),
        "claimed_only": len(claimed_only_skills)
    }

    return {
        "proven_skills": proven_skills,
        "claimed_only_skills": claimed_only_skills,
        "depth_summary": depth_summary
    }

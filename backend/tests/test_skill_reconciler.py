"""
Unit tests for read-only skill reconciler.
"""

from app.agent.schemas import CandidateProfile, WorkExperienceRole, ExperienceBullet
from app.agent.tools.skill_reconciler import reconcile_candidate_skills


def test_reconcile_candidate_skills():
    profile = CandidateProfile(
        name="Ayesha Rahman",
        skills_declared=["Python", "FastAPI", "Kubernetes"],
        previous_roles=[
            WorkExperienceRole(
                id="E1",
                title="Backend Engineer",
                bullets=[
                    ExperienceBullet(id="E1.1", text="Developed REST APIs in Python using FastAPI.")
                ]
            )
        ]
    )

    res = reconcile_candidate_skills(profile)
    proven = [s.skill_name for s in res["proven_skills"]]
    claimed = [s.skill_name for s in res["claimed_only_skills"]]

    assert "Python" in proven
    assert "FastAPI" in proven
    assert "Kubernetes" in claimed
    assert res["depth_summary"]["proven"] == 2
    assert res["depth_summary"]["claimed_only"] == 1

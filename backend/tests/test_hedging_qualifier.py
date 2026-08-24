import pytest
from app.agent.tools.scoring import _sanitize_match_val

class MockProfile:
    skills = ["Python", "FastAPI", "PostgreSQL", "AWS", "Docker", "Kubernetes", "LangChain"]
    raw_cv_text = """
AYESHA RAHMAN
Senior Backend Engineer
- Designed and shipped 40+ FastAPI microservices handling 12M requests/day.
- Rebuilt the PostgreSQL access layer: authored partial and composite indexes.
- Deployed all services to AWS using ECS Fargate.
- Assisted with the migration of three legacy services to a Kubernetes cluster.
"""

def test_hedging_qualifier_does_not_cross_contaminate_unrelated_bullets():
    profile = MockProfile()
    
    # Solid evidence quote should retain full credit regardless of unrelated "assisted" bullet elsewhere
    match_val, note = _sanitize_match_val(
        req_name="Python and FastAPI",
        match_val="full",
        evidence_val="Designed and shipped 40+ FastAPI microservices handling 12M requests/day",
        candidate_profile=profile
    )
    assert match_val == "full"
    assert note == ""

    # Requirement using the actual assisted bullet should be capped to partial
    match_val_k8s, note_k8s = _sanitize_match_val(
        req_name="Kubernetes",
        match_val="full",
        evidence_val="Assisted with the migration of three legacy services to a Kubernetes cluster",
        candidate_profile=profile
    )
    assert match_val_k8s == "partial"
    assert "Capped to partial due to low-proficiency" in note_k8s

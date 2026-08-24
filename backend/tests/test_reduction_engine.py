"""
Unit tests for 3-branch reduction engine.
"""

import pytest
from app.agent.schemas import CandidateProfile, WorkExperienceRole, ExperienceBullet
from app.agent.tools.reduction_engine import reduce_match, is_skill_grounded_in_declared


def test_is_skill_grounded_in_declared():
    """Test domain-agnostic token + acronym matching replaces SKILL_ALIASES."""
    skills_declared = ["Python", "FastAPI", "Docker", "Kubernetes", "AWS"]
    # Direct token matches (preserved from original alias_hit behavior)
    assert is_skill_grounded_in_declared("Python", skills_declared) is True
    assert is_skill_grounded_in_declared("FastAPI / REST APIs", skills_declared) is True
    assert is_skill_grounded_in_declared("Docker / Containerization", skills_declared) is True
    # Acronym matching (new capability)
    assert is_skill_grounded_in_declared("K8s", ["Kubernetes"]) is True
    # Non-tech domain: healthcare
    assert is_skill_grounded_in_declared("Pediatric Nursing", ["Pediatric Nursing", "ICU Triage"]) is True
    assert is_skill_grounded_in_declared("ICU Triage", ["Pediatric Nursing", "ICU Triage"]) is True
    # Non-tech domain: finance
    assert is_skill_grounded_in_declared("GAAP Accounting", ["GAAP", "Financial Analysis"]) is True
    # Absent skills must return False
    assert is_skill_grounded_in_declared("PostgreSQL", skills_declared) is False
    assert is_skill_grounded_in_declared("Cardiac Surgery", ["Python", "Docker"]) is False


def test_acronym_matching():
    """Test conservative acronym expansion doesn't produce false positives."""
    # Valid acronym matches
    assert is_skill_grounded_in_declared("NLP", ["Natural Language Processing"]) is True
    assert is_skill_grounded_in_declared("Natural Language Processing", ["NLP"]) is True
    # Acronym must match word count exactly — prevents over-matching
    assert is_skill_grounded_in_declared("CI", ["Continuous Integration"]) is True
    assert is_skill_grounded_in_declared("CI", ["Clinical Investigation"]) is True
    # Non-acronym lowercase strings should NOT trigger acronym matching
    assert is_skill_grounded_in_declared("go", ["General Operations"]) is False


def test_reduce_match_proven_branch():
    profile = CandidateProfile(
        name="Ayesha Rahman",
        skills_declared=["Python", "FastAPI", "Docker"],
        previous_roles=[
            WorkExperienceRole(
                id="E1",
                title="Senior Backend Engineer",
                company="TechCorp",
                bullets=[
                    ExperienceBullet(id="E1.1", text="Built high-throughput FastAPI microservices in Python."),
                    ExperienceBullet(id="E1.2", text="Assisted DevOps team with Docker container builds.")
                ]
            )
        ]
    )

    # Exact + Owned -> full
    verdict, flag = reduce_match("Python", ["E1.1"], "exact", "owned", True, profile)
    assert verdict == "full"
    assert flag is None

    # Exact + Assisted (hedged) -> partial
    verdict, flag = reduce_match("Docker", ["E1.2"], "exact", "owned", True, profile)
    assert verdict == "partial"  # downgraded via HEDGE_RE ("Assisted")


def test_reduce_match_claim_only_branch():
    profile = CandidateProfile(
        name="Bilal Nawaz",
        skills_declared=["Python", "FastAPI", "Docker", "Kubernetes", "AWS"],
        previous_roles=[
            WorkExperienceRole(
                id="E1",
                title="Web Developer",
                company="PixelForge",
                bullets=[
                    ExperienceBullet(id="E1.1", text="Managed MySQL databases and cPanel hosting.")
                ]
            )
        ]
    )

    # No evidence bullet, but declared in skills -> partial + claim_only flag
    verdict, flag = reduce_match("Kubernetes", [], "exact", "none", True, profile)
    assert verdict == "partial"
    assert flag == "claim_only"

    # Alias hit backstop
    verdict, flag = reduce_match("FastAPI", [], "exact", "none", False, profile)
    assert verdict == "partial"
    assert flag == "claim_only"


def test_reduce_match_absent_branch():
    profile = CandidateProfile(
        name="Bilal Nawaz",
        skills_declared=["Python", "FastAPI"],
        previous_roles=[]
    )

    # No bullets, not in skills declared -> none + absent flag
    verdict, flag = reduce_match("Go / Golang", [], "exact", "none", False, profile)
    assert verdict == "none"
    assert flag == "absent"


def test_bullet_recovery_without_category_aliases():
    """
    Regression test: verify that bullet recovery still works for requirements
    with parenthetical tool alternatives after CATEGORY_ALIASES removal.
    
    This is the critical path at reduce_match() lines 262-269.
    """
    profile = CandidateProfile(
        name="Test Candidate",
        skills_declared=["AWS", "Docker"],
        previous_roles=[
            WorkExperienceRole(
                id="E1",
                title="DevOps Engineer",
                company="CloudCorp",
                bullets=[
                    ExperienceBullet(id="E1.1", text="Deployed microservices to AWS ECS Fargate with Terraform."),
                    ExperienceBullet(id="E1.2", text="Built Jenkins CI/CD pipelines for automated testing and deployment."),
                    ExperienceBullet(id="E1.3", text="Managed PostgreSQL and Redis clusters in production."),
                ]
            )
        ]
    )
    # Cloud requirement with parenthetical alternatives — must recover bullet E1.1
    verdict, flag = reduce_match(
        "Cloud Infrastructure (AWS / GCP / Azure)", [], "exact", "used", True, profile
    )
    assert verdict in ("full", "partial")
    assert flag is None  # Must be Branch A (proven), not Branch B (claim_only)

    # CI/CD requirement with parenthetical alternatives — must recover bullet E1.2
    verdict, flag = reduce_match(
        "CI/CD Pipelines (Jenkins, GitHub Actions)", [], "exact", "used", True, profile
    )
    assert verdict in ("full", "partial")
    assert flag is None

    # Database requirement with parenthetical alternatives — must recover bullet E1.3
    verdict, flag = reduce_match(
        "Database Management (PostgreSQL / MySQL)", [], "exact", "used", True, profile
    )
    assert verdict in ("full", "partial")
    assert flag is None


def test_non_tech_bullet_recovery():
    """Verify bullet recovery works for non-tech domains without CATEGORY_ALIASES."""
    profile = CandidateProfile(
        name="Healthcare Candidate",
        skills_declared=["Pediatric Nursing", "ICU Triage"],
        previous_roles=[
            WorkExperienceRole(
                id="E1",
                title="Registered Nurse",
                company="City Hospital",
                bullets=[
                    ExperienceBullet(id="E1.1", text="Performed pediatric triage assessments in the emergency department."),
                    ExperienceBullet(id="E1.2", text="Administered medications per physician orders following standard clinical protocols."),
                ]
            )
        ]
    )
    # Non-tech: nursing requirement — must recover bullet E1.1
    verdict, flag = reduce_match(
        "Pediatric Nursing", [], "exact", "used", True, profile
    )
    assert verdict in ("full", "partial")
    assert flag is None

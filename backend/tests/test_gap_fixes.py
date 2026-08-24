"""
Regression tests for gap fixes G1–G6.
Tests the supplementary fixes that complement the original Domain-Agnostic Skill Resolution plan.
"""
import pytest
from app.agent.tools.skills import is_skill_match, evaluate_mandatory_skills, _is_numeronym_match
from app.agent.tools.verification import extract_dynamic_requirement_tokens


# ── G3: Numeronym matching in is_skill_match ──────────────────────────────────
class TestNumeronymMatching:
    """G3: Verify k8s-style numeronyms are handled after ALIAS_MAP removal."""

    def test_k8s_matches_kubernetes(self):
        assert is_skill_match("k8s", "Kubernetes") is True
        assert is_skill_match("Kubernetes", "k8s") is True

    def test_i18n_matches_internationalization(self):
        assert is_skill_match("i18n", "Internationalization") is True
        assert is_skill_match("Internationalization", "i18n") is True

    def test_a11y_matches_accessibility(self):
        assert is_skill_match("a11y", "Accessibility") is True
        assert is_skill_match("Accessibility", "a11y") is True

    def test_non_numeronym_not_matched(self):
        """Regular short strings must NOT trigger numeronym matching."""
        assert _is_numeronym_match("api", "Application Programming Interface") is False
        assert _is_numeronym_match("sql", "Structured Query Language") is False
        assert _is_numeronym_match("123", "numbers") is False

    def test_numeronym_helper_edge_cases(self):
        assert _is_numeronym_match("k8s", "kubernetes") is True
        assert _is_numeronym_match("k8s", "kafka") is False  # ends with 'a', not 's'
        assert _is_numeronym_match("", "kubernetes") is False
        assert _is_numeronym_match("k8s", "") is False


# ── G3: evaluate_mandatory_skills pipeline ────────────────────────────────────
class TestMandatorySkillsWithNumeronyms:
    """G3: Verify hard_filters.py pipeline doesn't regress on k8s after ALIAS_MAP removal."""

    def test_k8s_passes_kubernetes_mandatory(self):
        passed, missing = evaluate_mandatory_skills(
            candidate_skills=["Python", "Docker", "K8s", "AWS"],
            required_skills=["Kubernetes"]
        )
        assert passed is True
        assert missing == []

    def test_kubernetes_passes_k8s_mandatory(self):
        passed, missing = evaluate_mandatory_skills(
            candidate_skills=["Python", "Kubernetes"],
            required_skills=["k8s"]
        )
        assert passed is True
        assert missing == []

    def test_missing_skill_still_fails(self):
        """Unrelated skills must still fail mandatory checks."""
        passed, missing = evaluate_mandatory_skills(
            candidate_skills=["Python", "Docker"],
            required_skills=["Kubernetes"]
        )
        assert passed is False
        assert "Kubernetes" in missing

    def test_spelling_normalization_still_works(self):
        """British -ise spelling must still match -ize after ALIAS_MAP removal."""
        passed, missing = evaluate_mandatory_skills(
            candidate_skills=["Containerisation"],
            required_skills=["Containerization"]
        )
        assert passed is True
        assert missing == []


# ── G5: Java/JavaScript false positive ────────────────────────────────────────
class TestWordBoundaryMatching:
    """G5: Verify Java does NOT match JavaScript via word-intersection."""

    def test_java_not_matches_javascript(self):
        """Declaring 'Java' must NOT give credit for 'JavaScript' requirement."""
        from app.agent.tools.reduction_engine import is_skill_grounded_in_declared
        assert is_skill_grounded_in_declared("JavaScript", ["Java"]) is False

    def test_javascript_not_matches_java(self):
        from app.agent.tools.reduction_engine import is_skill_grounded_in_declared
        assert is_skill_grounded_in_declared("Java", ["JavaScript"]) is False

    def test_java_still_matches_java(self):
        from app.agent.tools.reduction_engine import is_skill_grounded_in_declared
        assert is_skill_grounded_in_declared("Java", ["Java"]) is True

    def test_python_matches_python3(self):
        """'python' should still match 'python 3' via word boundary."""
        from app.agent.tools.reduction_engine import is_skill_grounded_in_declared
        assert is_skill_grounded_in_declared("Python", ["Python 3"]) is True


# ── G6: Conditional category expansion ────────────────────────────────────────
class TestConditionalCategoryExpansion:
    """G6: Verify bare category requirements still produce tool tokens, but parenthetical requirements don't double-expand."""

    def test_bare_cloud_expands(self):
        """Bare 'Cloud Infrastructure' must expand to include AWS, GCP, etc."""
        tokens = extract_dynamic_requirement_tokens("Cloud Infrastructure")
        assert "aws" in tokens
        assert "gcp" in tokens
        assert "azure" in tokens
        assert "terraform" in tokens

    def test_bare_cicd_expands(self):
        """Bare 'CI/CD' must expand to include Jenkins, GitHub Actions, etc."""
        tokens = extract_dynamic_requirement_tokens("CI/CD")
        assert "jenkins" in tokens
        assert "github" in tokens

    def test_bare_database_expands(self):
        tokens = extract_dynamic_requirement_tokens("Database Management")
        assert "postgresql" in tokens
        assert "mysql" in tokens
        assert "mongodb" in tokens

    def test_parenthetical_does_not_expand(self):
        """Requirements WITH parentheticals must NOT trigger category expansion."""
        tokens = extract_dynamic_requirement_tokens("Cloud Infrastructure (AWS / GCP)")
        # Should have aws and gcp from parenthetical parsing, NOT from category expansion
        assert "aws" in tokens
        assert "gcp" in tokens
        # Terraform should NOT be present — it's not in the parentheticals and expansion is skipped
        assert "terraform" not in tokens

    def test_bare_container_expands(self):
        tokens = extract_dynamic_requirement_tokens("Container Orchestration")
        assert "docker" in tokens
        assert "kubernetes" in tokens

    def test_non_category_bare_requirement_no_expansion(self):
        """Requirements that don't match any category should not expand."""
        tokens = extract_dynamic_requirement_tokens("Machine Learning")
        # Should NOT have any category expansion tokens
        assert "aws" not in tokens
        assert "jenkins" not in tokens
        assert "docker" not in tokens
        # Should still have the requirement's own tokens
        assert "machine" in tokens


# ── G6: End-to-end bullet recovery with bare requirements ─────────────────────
class TestBulletRecoveryBareRequirements:
    """G6: End-to-end test that bare category requirements still recover bullets via reduce_match."""

    def test_bare_cloud_recovers_aws_bullet(self):
        from app.agent.schemas import CandidateProfile, WorkExperienceRole, ExperienceBullet
        from app.agent.tools.reduction_engine import reduce_match
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
                        ExperienceBullet(id="E1.2", text="Managed team standups and sprint planning."),
                    ]
                )
            ]
        )
        # Bare "Cloud Infrastructure" (no parentheticals) must still recover E1.1
        verdict, flag = reduce_match(
            "Cloud Infrastructure", [], "exact", "used", True, profile
        )
        assert verdict in ("full", "partial")
        assert flag is None  # Must be Branch A (proven), not Branch B (claim_only)

    def test_bare_cicd_recovers_jenkins_bullet(self):
        from app.agent.schemas import CandidateProfile, WorkExperienceRole, ExperienceBullet
        from app.agent.tools.reduction_engine import reduce_match
        profile = CandidateProfile(
            name="Test Candidate",
            skills_declared=["Jenkins"],
            previous_roles=[
                WorkExperienceRole(
                    id="E1",
                    title="DevOps Engineer",
                    company="BuildCorp",
                    bullets=[
                        ExperienceBullet(id="E1.1", text="Built Jenkins CI/CD pipelines for automated testing."),
                    ]
                )
            ]
        )
        # Bare "CI/CD" (no parentheticals) must still recover E1.1
        verdict, flag = reduce_match(
            "CI/CD", [], "exact", "used", True, profile
        )
        assert verdict in ("full", "partial")
        assert flag is None

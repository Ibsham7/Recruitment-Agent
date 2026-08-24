"""
Full calibration benchmark test suite for Claim-Aware Scoring Architecture.
Tests 6 test CVs against JD in Latest Test/ folder.
"""

import json
import pytest
from app.agent.schemas import CandidateProfile, WorkExperienceRole, ExperienceBullet, RequirementMatch
from app.agent.tools.reduction_engine import reduce_match, is_skill_grounded_in_declared


def test_bilal_stuffer_alert():
    """Verify keyword stuffer Bilal gets STUFFER_ALERT and partial credit across claim-only requirements."""
    profile = CandidateProfile(
        name="Bilal Nawaz",
        skills_declared=["Python", "FastAPI", "Docker", "Kubernetes", "AWS", "PostgreSQL"],
        previous_roles=[
            WorkExperienceRole(
                id="E1",
                title="Web Developer",
                company="PixelForge",
                bullets=[
                    ExperienceBullet(id="E1.1", text="Managed MySQL databases for client websites and performed routine backups.")
                ]
            )
        ]
    )

    must_haves = [
        "Python and FastAPI",
        "Docker and Kubernetes",
        "AWS Cloud Infrastructure",
        "PostgreSQL Optimization",
        "CI/CD Pipelines"
    ]

    claim_only_count = 0
    for req in must_haves:
        verdict, flag = reduce_match(req, [], "exact", "none", True, profile)
        if flag == "claim_only":
            claim_only_count += 1
            assert verdict == "partial"

    coverage = claim_only_count / len(must_haves)
    assert coverage >= 0.5
    assert claim_only_count >= 4

    from app.agent.schemas import ScoreBreakdown, RequirementMatch
    from app.agent.tools.scoring import calculate_weighted_fit_score

    req_matches = [
        RequirementMatch(requirement=m, match="partial", evidence="Declared in skills section", declared_in_skills=True, evidence_type="skills_list_only", proficiency_signal="used")
        for m in must_haves
    ]

    sb = ScoreBreakdown()
    score, decision, note = calculate_weighted_fit_score(
        score_breakdown=sb,
        eval_mode="default",
        must_have=req_matches,
        candidate_profile=profile
    )

    assert "STUFFER_ALERT" in sb.flags
    assert "unproven_claims" in sb.flags
    assert sb.claim_only_coverage >= 0.8
    assert sb.must_have_breakdown[0].declared_in_skills is True
    assert sb.must_have_breakdown[0].ui_warning is not None
    assert "⚠️" in sb.must_have_breakdown[0].ui_warning


def test_ayesha_proven_skills():
    """Verify strong candidate Ayesha gets full credit for proven skills and assisted partial for Docker/K8s."""
    profile = CandidateProfile(
        name="Ayesha Rahman",
        skills_declared=["Python", "FastAPI", "Docker", "Kubernetes", "AWS", "Terraform"],
        previous_roles=[
            WorkExperienceRole(
                id="E1",
                title="Senior Backend Engineer",
                company="TechCorp",
                bullets=[
                    ExperienceBullet(id="E1.1", text="Architected AWS cloud infrastructure using ECS Fargate and Terraform."),
                    ExperienceBullet(id="E1.2", text="Built high-throughput FastAPI microservices in Python."),
                    ExperienceBullet(id="E1.3", text="Assisted DevOps team with Docker container builds and EKS deployments.")
                ]
            )
        ]
    )

    # Cloud (AWS/Terraform) -> proven, exact, owned -> full
    verdict, flag = reduce_match("AWS Cloud Infrastructure", ["E1.1"], "exact", "owned", True, profile)
    assert verdict == "full"

    # Python/FastAPI -> proven, exact, owned -> full
    verdict, flag = reduce_match("Python and FastAPI", ["E1.2"], "exact", "owned", True, profile)
    assert verdict == "full"

    # Docker/K8s -> proven, exact, assisted (hedged) -> partial
    verdict, flag = reduce_match("Docker and Kubernetes", ["E1.3"], "exact", "owned", True, profile)
    assert verdict == "partial"


def test_ayesha_rahman_evidence_quote_grounding():
    """Verify that when evidence quotes exist in work experience, a candidate with declared skills is classified as PROVEN, not claim_only."""
    profile = CandidateProfile(
        name="Ayesha Rahman",
        skills_declared=["Python", "FastAPI", "PostgreSQL", "AWS", "Docker", "Kubernetes", "LLM", "RAG"],
        previous_roles=[
            WorkExperienceRole(
                id="E1",
                title="Senior Backend Engineer",
                company="TechCorp",
                description="Designed and shipped 40+ FastAPI microservices in Python. Authored partial and composite indexes, analysed EXPLAIN ANALYZE execution plans in PostgreSQL. Deployed all services to AWS using ECS Fargate. Built a production RAG pipeline over 2.4M internal documents.",
            ),
            WorkExperienceRole(
                id="E2",
                title="Backend Developer",
                company="DevHouse",
                description="Containerised the full stack with Docker.",
            )
        ]
    )

    requirements_and_quotes = [
        ("Python and FastAPI", "Designed and shipped 40+ FastAPI microservices"),
        ("PostgreSQL Optimization", "authored partial and composite indexes, analysed EXPLAIN ANALYZE execution plans"),
        ("AWS Cloud Infrastructure", "Deployed all services to AWS using ECS Fargate"),
        ("Docker and Kubernetes", "Containerised the full stack with Docker"),
        ("LLM and RAG integration", "Built a production RAG pipeline over 2.4M internal documents")
    ]

    claim_only_count = 0
    for req_name, ev_quote in requirements_and_quotes:
        verdict, flag = reduce_match(
            requirement_name=req_name,
            evidence_bullet_ids=[],
            scope="exact",
            depth="owned",
            declared_in_skills=True,
            candidate_profile=profile,
            evidence_quote=ev_quote
        )
        assert verdict in ("full", "partial")
        assert flag is None  # MUST NOT be claim_only!
        if flag == "claim_only":
            claim_only_count += 1

    assert claim_only_count == 0  # 0% claim-only coverage!



def test_determinism():
    """Verify running reduction engine twice on same profile yields identical verdicts."""
    profile = CandidateProfile(
        name="Daniyal Sheikh",
        skills_declared=["Python", "FastAPI", "Docker", "AWS"],
        previous_roles=[
            WorkExperienceRole(
                id="E1",
                title="Software Engineer",
                bullets=[ExperienceBullet(id="E1.1", text="Built FastAPI services in Python.")]
            )
        ]
    )

    r1_v, r1_f = reduce_match("Python", ["E1.1"], "exact", "owned", True, profile)
    r2_v, r2_f = reduce_match("Python", ["E1.1"], "exact", "owned", True, profile)
    assert r1_v == r2_v
    assert r1_f == r2_f


def test_honest_candidate_claim_only_sanitization():
    """Verify an honest candidate with declared skills (no bullets) gets partial credit after _sanitize_match_val."""
    from app.agent.tools.scoring import _sanitize_match_val

    profile = CandidateProfile(
        name="Honest Candidate",
        skills_declared=["Python", "FastAPI", "PostgreSQL"],
        previous_roles=[
            WorkExperienceRole(
                id="E1",
                title="Software Developer",
                bullets=[ExperienceBullet(id="E1.1", text="Developed web applications.")]
            )
        ]
    )

    req_match = RequirementMatch(
        requirement="Python and FastAPI",
        match="partial",
        evidence="Declared in skills section",
        declared_in_skills=True,
        evidence_type="skills_list_only",
        proficiency_signal="used"
    )

    sanitized_val, note = _sanitize_match_val(
        req_name="Python and FastAPI",
        match_val="partial",
        evidence_val="Declared in skills section",
        item=req_match,
        eval_mode="default",
        candidate_profile=profile
    )

    # MUST NOT be overridden to 'none'!
    assert sanitized_val == "partial"
    assert "none" not in sanitized_val


def test_farrukh_khan_career_drift_experience_scoring():
    """Verify that career-drift candidate Farrukh Khan's non-engineering roles (Project Coordinator, QA Analyst) do not inflate domain engineering tenure."""
    from app.agent.tools.timeline import calculate_experience_for_domain
    from app.agent.tools.scoring import calculate_weighted_fit_score
    from app.agent.schemas import ScoreBreakdown, CanonicalJDSpec, CanonicalJDRequirement

    profile = CandidateProfile(
        name="Farrukh Khan",
        total_experience_years=17.2,
        relevant_experience_years=3.5,
        skills_declared=["Java", "C++", "Python", "Oracle", "SQL Server"],
        previous_roles=[
            WorkExperienceRole(
                id="E1",
                title="Technical Project Coordinator",
                company="Meridian Enterprise Solutions",
                start_date="2021-03",
                end_date="Present",
                description="Coordinate cross-functional delivery. Liaison between client stakeholders and internal Java team. Self-studying Python scripts."
            ),
            WorkExperienceRole(
                id="E2",
                title="Senior QA Analyst",
                company="Falcon Telecom Systems",
                start_date="2016-07",
                end_date="2021-02",
                description="Led manual and semi-automated testing efforts for telecom billing built in Java and legacy C++."
            ),
            WorkExperienceRole(
                id="E3",
                title="Software Engineer",
                company="Crestline Manufacturing Technologies",
                start_date="2013-01",
                end_date="2016-06",
                description="Developed and maintained internal enterprise applications in Java (Spring) against Oracle database."
            ),
            WorkExperienceRole(
                id="E4",
                title="Hardware QA Technician",
                company="Silverline Electronics",
                start_date="2010-08",
                end_date="2012-12",
                description="Performed functional testing on consumer electronics hardware."
            ),
            WorkExperienceRole(
                id="E5",
                title="Junior Developer",
                company="Bridgeway IT Services",
                start_date="2009-06",
                end_date="2010-07",
                description="Entry-level role building small internal tools in classic ASP.NET."
            )
        ]
    )

    domain_kw = ["Senior Backend Engineer", "Software Engineer", "Python", "Java", "PostgreSQL", "FastAPI"]
    det_years = calculate_experience_for_domain(profile.previous_roles, keywords=domain_kw)

    # Project Coordinator and QA Analyst roles MUST NOT count as hands-on engineering tenure
    assert det_years <= 4.7  # Only Software Engineer (3.5 yrs) + Junior Developer (1.2 yrs)

    # Evaluate scoring breakdown
    sb = ScoreBreakdown()
    spec = CanonicalJDSpec(
        role_title="Senior Backend Engineer",
        required_years=5.0,
        must_have_skills=[CanonicalJDRequirement(id="MUST_1", requirement_name="Python and FastAPI")]
    )

    score, decision, note = calculate_weighted_fit_score(
        score_breakdown=sb,
        eval_mode="default",
        candidate_profile=profile,
        required_years=5.0,
        canonical_jd_spec=spec,
        experience_assessment="The candidate has 3.5 years of direct software engineering experience (2013-2016), but has spent the last 5.5 years in project coordination roles."
    )

    # Verify experience breakdown accurately captures relevant experience shortfall (3.5 yrs / 5.0 yrs req = 70/100 -> 17.5 pts out of 25)
    exp_bd = sb.experience_breakdown
    assert exp_bd.relevant_years == 3.5
    assert exp_bd.score == 70  # (3.5 / 5.0) * 100
    assert exp_bd.points_earned == 17.5  # 70 * 0.25


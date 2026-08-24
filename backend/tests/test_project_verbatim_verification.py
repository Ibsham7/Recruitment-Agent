from app.agent.schemas import CandidateProfile, CandidateProfileOutput, ProjectRecord, ExperienceBullet
from app.agent.tools.reduction_engine import build_bullet_index, reduce_match
from app.agent.nodes.jd_matcher import extract_verbatim_sentence_for_requirement
from app.agent.tools.skill_reconciler import reconcile_candidate_skills
from app.agent.nodes.cv_parser import reconstruct_raw_text_from_profile

def test_schema_backward_compatibility():
    # 1. Legacy string list
    data1 = {"name": "Test Candidate", "projects": ["Built web app in React", "Distributed ML pipeline"]}
    p1 = CandidateProfileOutput(**data1)
    assert len(p1.projects) == 2
    assert isinstance(p1.projects[0], ProjectRecord)
    assert p1.projects[0].title == "Built web app in React"

    # 2. Legacy dict format
    data2 = {"name": "Test Candidate", "projects": [{"title": "Data Pipeline", "description": "ETL in Spark", "skills_used": ["Spark", "Python"]}]}
    p2 = CandidateProfileOutput(**data2)
    assert len(p2.projects) == 1
    assert p2.projects[0].skills_used == ["Spark", "Python"]

    # 3. New structured ProjectRecord format with bullets
    data3 = {
        "name": "Test Candidate",
        "projects": [
            ProjectRecord(
                id="P1",
                title="Agentic Recruiter",
                organization="Open Source",
                skills_used=["FastAPI", "LangChain", "PostgreSQL"],
                bullets=[
                    ExperienceBullet(id="P1.1", text="Built multi-agent recruitment pipeline with FastAPI"),
                    ExperienceBullet(id="P1.2", text="Optimized vector search using pgvector")
                ]
            )
        ]
    }
    p3 = CandidateProfileOutput(**data3)
    assert len(p3.projects) == 1
    assert p3.projects[0].bullets[0].id == "P1.1"
    assert p3.projects[0].bullets[1].id == "P1.2"
    print("[PASS] test_schema_backward_compatibility")

def test_bullet_indexing():
    profile = {
        "previous_roles": [
            {"id": "E1", "title": "Software Engineer", "bullets": [{"id": "E1.1", "text": "Designed microservices"}]}
        ],
        "projects": [
            {
                "id": "P1",
                "title": "Autonomous Agent",
                "bullets": [{"id": "P1.1", "text": "Developed agentic workflow in Python and LangGraph"}]
            }
        ],
        "key_achievements": ["Won 1st place in national hackathon"]
    }
    index = build_bullet_index(profile)
    assert "E1.1" in index
    assert index["E1.1"]["source"] == "employment"
    assert "P1.1" in index
    assert index["P1.1"]["source"] == "project_work"
    assert "A1" in index
    assert index["A1"]["source"] == "employment"
    print("[PASS] test_bullet_indexing")

def test_reduction_engine_project_verbatim():
    profile = CandidateProfile(
        name="John Doe",
        projects=[
            ProjectRecord(
                id="P1",
                title="Cloud Migration Initiative",
                organization="FinTech Client",
                skills_used=["Kubernetes", "Docker", "Terraform"],
                bullets=[
                    ExperienceBullet(id="P1.1", text="Architected Kubernetes clusters and automated deployments with Helm"),
                    ExperienceBullet(id="P1.2", text="Configured Terraform infrastructure-as-code modules on AWS")
                ]
            )
        ],
        skills_declared=["Kubernetes", "Terraform"],
        skills=["Kubernetes", "Terraform", "Docker"],
        raw_cv_text="Architected Kubernetes clusters and automated deployments with Helm. Configured Terraform infrastructure-as-code modules on AWS."
    )

    # Test 1: Kubernetes match supported by P1.1
    verdict, flag = reduce_match(
        requirement_name="Kubernetes & Container Orchestration",
        evidence_bullet_ids=["P1.1"],
        scope="exact",
        depth="built",
        declared_in_skills=True,
        candidate_profile=profile,
        evidence_quote="Architected Kubernetes clusters and automated deployments with Helm"
    )
    assert verdict == "full", f"Expected full match, got {verdict}"
    assert flag is None, f"Expected no downgrade flag, got {flag}"

    # Test 2: Terraform match without explicit bullet IDs (deterministic token recovery)
    verdict2, flag2 = reduce_match(
        requirement_name="Terraform Infrastructure as Code",
        evidence_bullet_ids=[],
        scope="exact",
        depth="used",
        declared_in_skills=True,
        candidate_profile=profile,
        evidence_quote="Configured Terraform infrastructure-as-code modules on AWS"
    )
    assert verdict2 == "full", f"Expected full match via recovery, got {verdict2}"
    print("[PASS] test_reduction_engine_project_verbatim")

def test_verbatim_sentence_ranking():
    profile = CandidateProfile(
        name="Jane Doe",
        previous_roles=[],
        projects=[
            ProjectRecord(
                id="P1",
                title="Deep Learning Recommendation Engine",
                skills_used=["PyTorch", "Redis"],
                description="Built high-throughput recommendation engine using PyTorch and Redis",
                bullets=[
                    ExperienceBullet(id="P1.1", text="Engineered PyTorch neural collaborative filtering model scaling to 10M users")
                ]
            )
        ],
        raw_cv_text="PROJECTS\nDeep Learning Recommendation Engine\nEngineered PyTorch neural collaborative filtering model scaling to 10M users"
    )
    line = extract_verbatim_sentence_for_requirement("PyTorch", profile)
    assert line is not None
    assert "PyTorch" in line
    assert "Engineered PyTorch" in line

    line2 = extract_verbatim_sentence_for_requirement("Deep Learning", profile)
    assert line2 is not None
    assert "Deep Learning" in line2
    print("[PASS] test_verbatim_sentence_ranking")

def test_skill_reconciler_with_projects():
    profile = CandidateProfile(
        name="Bob",
        previous_roles=[],
        projects=[
            ProjectRecord(
                id="P1",
                title="Open Source Library",
                bullets=[ExperienceBullet(id="P1.1", text="Implemented async Redis client in Rust")]
            )
        ],
        skills_declared=["Rust", "Go"],
        skills=["Rust", "Go"]
    )
    reconciled = reconcile_candidate_skills(profile)
    proven = [s.skill_name for s in reconciled["proven_skills"]]
    claimed = [s.skill_name for s in reconciled["claimed_only_skills"]]
    assert "Rust" in proven
    assert "Go" in claimed
    print("[PASS] test_skill_reconciler_with_projects")

def test_cv_summary_with_project_record():
    profile = CandidateProfile(
        name="Bob",
        previous_roles=[],
        education=["BS Computer Science"],
        projects=[
            ProjectRecord(
                id="P1",
                title="Agentic Recruiter",
                organization="Open Source",
                skills_used=["FastAPI", "Python"]
            )
        ],
        skills=["Python"]
    )
    cv_summary = (
        f"Skills: {', '.join(profile.skills)}. "
        f"Experience: {profile.total_experience_years} years. "
        f"Roles: {', '.join([str(r) for r in profile.previous_roles])}. "
        f"Education: {', '.join([str(e) for e in getattr(profile, 'education', [])])}. "
        f"Projects: {', '.join([str(p) for p in getattr(profile, 'projects', [])])}. "
        f"Other Info: {getattr(profile, 'other_info', '')}."
    )
    assert "Agentic Recruiter (Open Source)" in cv_summary
    print("[PASS] test_cv_summary_with_project_record")

if __name__ == "__main__":
    test_schema_backward_compatibility()
    test_bullet_indexing()
    test_reduction_engine_project_verbatim()
    test_verbatim_sentence_ranking()
    test_skill_reconciler_with_projects()
    test_cv_summary_with_project_record()
    print("\nALL PHASE 6 VERIFICATION CHECKS PASSED!")

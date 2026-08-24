import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..")))

import pytest
from app.agent.state import coerce_model, RecruitmentState
from app.agent.schemas import CandidateProfile, ScreeningResult, CanonicalJDSpec, ScoreBreakdown
from app.agent.graph import build_recruitment_graph, route_after_screening, route_after_hard_filters, route_after_embedding_matcher
from langgraph.graph import END

def test_coerce_model_helper():
    """Verify that coerce_model handles None, instances, and dicts safely."""
    # 1. None
    assert coerce_model(None, CandidateProfile) is None

    # 2. Dict input for CandidateProfile
    raw_profile_dict = {
        "name": "Jane Doe",
        "email": "jane@example.com",
        "phone": "+123456789",
        "total_experience_years": 5.0,
        "skills": ["Python", "FastAPI", "PostgreSQL"],
        "previous_roles": [{"title": "Backend Engineer", "company": "Acme Inc", "duration_years": 3.0}],
        "education": ["BS Computer Science"],
        "projects": [],
        "raw_cv_text": "Experienced Python developer with 5 years experience."
    }
    coerced_profile = coerce_model(raw_profile_dict, CandidateProfile)
    assert isinstance(coerced_profile, CandidateProfile)
    assert coerced_profile.name == "Jane Doe"
    assert coerced_profile.total_experience_years == 5.0
    assert "Python" in coerced_profile.skills

    # 3. Already CandidateProfile instance
    re_coerced = coerce_model(coerced_profile, CandidateProfile)
    assert re_coerced is coerced_profile

    # 4. Dict input for ScreeningResult
    raw_screening_dict = {
        "fit_score": 85.0,
        "decision": "advance",
        "reasoning_summary": "Strong candidate meeting all criteria.",
        "score_breakdown": {
            "required_skills_score": 90,
            "experience_score": 80,
            "nice_to_have_score": 85,
            "trajectory_score": 85
        }
    }
    coerced_screening = coerce_model(raw_screening_dict, ScreeningResult)
    assert isinstance(coerced_screening, ScreeningResult)
    assert coerced_screening.fit_score == 85.0
    assert coerced_screening.decision == "advance"

    # 5. Dict input for CanonicalJDSpec
    raw_spec_dict = {
        "spec_hash": "abc123hash",
        "role_title": "Senior Backend Engineer",
        "required_years": 4.0,
        "must_have_skills": [],
        "nice_to_have_skills": []
    }
    coerced_spec = coerce_model(raw_spec_dict, CanonicalJDSpec)
    assert isinstance(coerced_spec, CanonicalJDSpec)
    assert coerced_spec.role_title == "Senior Backend Engineer"
    assert coerced_spec.required_years == 4.0

@pytest.mark.asyncio
async def test_hard_filters_node_with_dict_state():
    """Verify hard_filters_node handles dict candidate_profile without AttributeError."""
    from app.agent.nodes.hard_filters import hard_filters_node
    
    dict_state: RecruitmentState = {
        "candidate_profile": {
            "name": "John Smith",
            "total_experience_years": 4.0,
            "skills": ["Python", "Docker"],
            "previous_roles": [],
            "education": [],
            "raw_cv_text": "Sample text"
        },
        "job_description": "Looking for Python engineer with 3+ years experience.",
        "hard_filters_config": [{"type": "experience", "value": 3.0, "penalty": "reject"}],
        "penalties": [],
        "pipeline_status": "running",
        "log": [],
        "cv_filepath": "test.pdf",
        "candidate_id": "cand_123",
        "enable_interviews": True,
        "interview_config": None,
        "jd_matcher_prompt_variant": "moderate",
        "canonical_jd_spec": None,
        "semantic_score": None,
        "screening_result": None,
        "interview_questions": [],
        "interview_transcript": None,
        "evaluation_report": None,
        "rejection_reason": None,
        "filter_rejections": [],
        "human_decision": None,
        "human_notes": None,
        "total_cost": 0.0,
        "stage_costs": {}
    }
    
    res = await hard_filters_node(dict_state)
    assert "log" in res
    assert res.get("pipeline_status") != "rejected"

def test_workflow1_graph_topology():
    """Verify clean single-purpose state graph construction for Workflow 1."""
    graph = build_recruitment_graph()
    assert graph is not None
    
    # Test routing logic
    state_shortlisted: RecruitmentState = {"pipeline_status": "running"}
    assert route_after_screening(state_shortlisted) == END
    
    state_rejected: RecruitmentState = {"pipeline_status": "rejected"}
    assert route_after_screening(state_rejected) == "rejected"
    assert route_after_hard_filters(state_rejected) == "rejected"
    assert route_after_embedding_matcher(state_rejected) == "rejected"
    
    state_human: RecruitmentState = {"pipeline_status": "awaiting_human"}
    assert route_after_screening(state_human) == "human_override"
    assert route_after_embedding_matcher(state_human) == "human_override"

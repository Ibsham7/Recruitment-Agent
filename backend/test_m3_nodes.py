import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from app.agent.schemas import (
    CandidateProfile,
    ScreeningResult,
    InterviewQuestion,
    InterviewTranscript,
    EvaluationReport,
    RequirementMatch,
    ScoreBreakdown
)
from app.agent.nodes.question_generator import question_generator_node
from app.agent.nodes.evaluator import evaluator_node, analyze_anti_cheat_signals
from app.agent.nodes.interviewer import interviewer_node, generate_followup_probe, current_question_with_probe, create_adaptive_probe_dict


def test_analyze_anti_cheat_signals_markdown_and_boilerplate():
    answers = [
        "## Summary of my experience\n\n- Firstly, I used Python to optimize queries.\n- Secondly, **furthermore**, in summary, I managed the cluster.\n- Thirdly, certainly! To address your question, it is important to note the architecture."
    ]
    telemetry = {
        "paste_ratio": 0.45,
        "paste_count": 3,
        "total_pasted_chars": 200,
        "blur_count": 4
    }
    
    score, flags = analyze_anti_cheat_signals(answers, telemetry)
    assert score > 50.0
    flag_names = [f["flag"] for f in flags]
    assert "MARKDOWN_OVERUSE" in flag_names
    assert "LLM_BOILERPLATE_TRANSITIONS" in flag_names
    assert "HIGH_PASTE_RATIO" in flag_names
    assert "FREQUENT_TAB_SWITCHES" in flag_names


def test_adaptive_probe_metadata():
    q = InterviewQuestion(
        question="Describe your experience with PyTorch.",
        category="technical",
        what_to_look_for="Deep neural net architectures"
    )
    probe_q = current_question_with_probe(q, "Can you provide a specific metric?")
    assert probe_q.is_probe is True
    assert probe_q.is_adaptive is True
    assert probe_q.timer_seconds == 45
    
    probe_dict = create_adaptive_probe_dict("What specific optimization did you run?")
    assert probe_dict["is_probe"] is True
    assert probe_dict["is_adaptive"] is True
    assert probe_dict["timer_seconds"] == 45


@pytest.mark.asyncio
async def test_question_generator_context_formatting():
    profile = CandidateProfile(
        name="Alice Johnson",
        total_experience_years=5.0,
        previous_roles=["Senior Backend Engineer at TechCorp"],
        skills=["Python", "PostgreSQL", "FastAPI"],
        projects=["Distributed Task Queue Platform"],
        key_achievements=["Reduced API latency by 40% using Redis caching"],
        education=["BS Computer Science"],
        other_info="AWS Certified"
    )
    screening = ScreeningResult(
        fit_score=85,
        score_breakdown=ScoreBreakdown(),
        must_have=[RequirementMatch(requirement="FastAPI", match="full", evidence="TechCorp")],
        nice_to_have=[]
    )
    state = {
        "candidate_profile": profile,
        "screening_result": screening,
        "job_description": "Seeking Senior Python Engineer with FastAPI experience.",
        "interview_config": "Focus on high concurrency and Redis"
    }

    mock_llm_response = {
        "parsed": MagicMock(
            questions=[
                InterviewQuestion(
                    question="In your role at TechCorp, you used Python and Redis to reduce API latency by 40%. How did you handle cache invalidation?",
                    category="technical",
                    what_to_look_for="Cache invalidation strategies, latency metrics"
                )
            ]
        )
    }

    with patch("app.agent.nodes.question_generator.get_model") as mock_get_model:
        mock_model = MagicMock()
        mock_structured = MagicMock()
        mock_structured.ainvoke = AsyncMock(return_value=mock_llm_response)
        mock_model.with_structured_output.return_value = mock_structured
        mock_get_model.return_value = mock_model

        res = await question_generator_node(state)
        assert len(res["interview_questions"]) == 1
        assert "TechCorp" in res["interview_questions"][0].question or "Redis" in res["interview_questions"][0].question

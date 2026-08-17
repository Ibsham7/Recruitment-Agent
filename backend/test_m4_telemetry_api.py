import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from app.agent.schemas import normalize_telemetry, AntiCheatMetadata, EvaluationReport
from app.main import InterviewAnswer, _format_candidate_dict, submit_interview_answer, get_candidate
from app.agent.api import process_interview_answer, _run_evaluator_background

def test_normalize_telemetry_camel_case():
    raw = {
        "blurCount": 3,
        "focusDuration": 120.5,
        "pasteCount": 2,
        "totalPastedChars": 150,
        "totalAnswerChars": 300,
        "pasteRatio": 0.5,
        "pasteTimestamps": ["2026-08-02T12:00:00Z"],
        "flags": ["PASTE_FLAG"]
    }
    norm = normalize_telemetry(raw)
    assert norm["blur_count"] == 3
    assert norm["blurCount"] == 3
    assert norm["focus_duration_seconds"] == 120.5
    assert norm["focusDuration"] == 120.5
    assert norm["paste_count"] == 2
    assert norm["pasteCount"] == 2
    assert norm["total_pasted_chars"] == 150
    assert norm["totalPastedChars"] == 150
    assert norm["total_answer_chars"] == 300
    assert norm["totalAnswerChars"] == 300
    assert norm["paste_ratio"] == 0.5
    assert norm["pasteRatio"] == 0.5
    assert norm["paste_timestamps"] == ["2026-08-02T12:00:00Z"]
    assert norm["flags"] == ["PASTE_FLAG"]

def test_normalize_telemetry_snake_case():
    raw = {
        "blur_count": 5,
        "focus_duration_seconds": 60.0,
        "paste_count": 1,
        "total_pasted_chars": 50,
        "total_answer_chars": 200,
        "paste_ratio": 0.25,
        "paste_timestamps": ["2026-08-02T12:05:00Z"],
        "flags": []
    }
    norm = normalize_telemetry(raw)
    assert norm["blur_count"] == 5
    assert norm["blurCount"] == 5
    assert norm["focus_duration_seconds"] == 60.0
    assert norm["focusDuration"] == 60.0
    assert norm["paste_count"] == 1
    assert norm["pasteCount"] == 1
    assert norm["total_pasted_chars"] == 50
    assert norm["totalPastedChars"] == 50
    assert norm["total_answer_chars"] == 200
    assert norm["totalAnswerChars"] == 200
    assert norm["paste_ratio"] == 0.25
    assert norm["pasteRatio"] == 0.25

def test_normalize_telemetry_defaults():
    norm = normalize_telemetry(None)
    assert norm["blur_count"] == 0
    assert norm["focus_duration_seconds"] == 0.0
    assert norm["paste_count"] == 0
    assert norm["total_pasted_chars"] == 0
    assert norm["total_answer_chars"] == 0
    assert norm["paste_ratio"] == 0.0
    assert norm["paste_timestamps"] == []
    assert norm["flags"] == []

def test_interview_answer_payload_parsing():
    # Test anti_cheat_telemetry
    payload1 = InterviewAnswer(
        answer="Sample answer text for interview",
        anti_cheat_telemetry={"blurCount": 2, "pasteCount": 1}
    )
    assert payload1.answer == "Sample answer text for interview"
    assert payload1.anti_cheat_telemetry == {"blurCount": 2, "pasteCount": 1}

    # Test telemetry key
    payload2 = InterviewAnswer(
        answer="Sample answer text 2",
        telemetry={"blur_count": 4}
    )
    assert payload2.telemetry == {"blur_count": 4}

def test_format_candidate_dict_evaluation_fields():
    raw_cand = {
        "id": "cand-123",
        "name": "Jane Doe",
        "evaluation": {
            "overallScore": 85.0,
            "interviewQuestions": '[{"question": "Tell me about Python"}]',
            "interviewTranscript": '[{"role": "candidate", "message": "I love Python"}]',
            "aiGeneratedLikelihoodScore": 15.0,
            "antiCheatFlags": '[{"flag": "MARKDOWN_OVERUSE", "severity": "medium"}]',
            "antiCheatMetadata": '{"blur_count": 2, "blurCount": 2, "paste_ratio": 0.1}'
        }
    }
    formatted = _format_candidate_dict(raw_cand)
    eval_data = formatted["evaluation"]
    assert eval_data["aiGeneratedLikelihoodScore"] == 15.0
    assert eval_data["ai_generated_likelihood_score"] == 15.0
    assert isinstance(eval_data["antiCheatFlags"], list)
    assert eval_data["antiCheatFlags"][0]["flag"] == "MARKDOWN_OVERUSE"
    assert eval_data["anti_cheat_flags"][0]["flag"] == "MARKDOWN_OVERUSE"
    assert isinstance(eval_data["antiCheatMetadata"], dict)
    assert eval_data["antiCheatMetadata"]["blur_count"] == 2
    assert eval_data["anti_cheat_metadata"]["blurCount"] == 2

@pytest.mark.asyncio
async def test_process_interview_answer_telemetry_embedding():
    mock_eval = MagicMock()
    mock_eval.interviewQuestions = [{"question": "Describe experience."}]
    mock_eval.interviewTranscript = []
    
    mock_cand = MagicMock()
    mock_cand.id = "cand-test-1"
    mock_cand.status = "interviewing"
    mock_cand.evaluation = mock_eval

    mock_tx = MagicMock()
    mock_tx.execute_raw = AsyncMock()
    mock_tx.candidate.find_unique = AsyncMock(return_value=mock_cand)
    mock_tx.evaluation.update = AsyncMock()
    mock_tx.candidate.update = AsyncMock()

    class MockTxContext:
        async def __aenter__(self):
            return mock_tx
        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    with patch("app.agent.api.prisma") as mock_prisma:
        mock_prisma.tx = MagicMock(return_value=MockTxContext())
        mock_prisma.candidate.find_unique = AsyncMock(return_value=mock_cand)
        mock_prisma.evaluation.update = mock_tx.evaluation.update
        mock_prisma.candidate.update = mock_tx.candidate.update

        telemetry_in = {"blurCount": 2, "pasteCount": 1, "totalPastedChars": 40}
        await process_interview_answer("cand-test-1", "This is my detailed response to the interview question.", telemetry=telemetry_in)

        # Verify prisma.evaluation.update was called with updated transcript containing turn telemetry and cumulative antiCheatMetadata
        assert mock_tx.evaluation.update.called
        call_kwargs = mock_tx.evaluation.update.call_args[1]
        data = call_kwargs["data"]

        transcript_arg = data["interviewTranscript"]
        transcript_data = getattr(transcript_arg, "data", getattr(transcript_arg, "val", transcript_arg))
        cand_turn = [t for t in transcript_data if t.get("role") == "candidate"][0]
        
        assert "telemetry" in cand_turn
        assert cand_turn["telemetry"]["blur_count"] == 2
        assert cand_turn["telemetry"]["paste_count"] == 1

        meta_arg = data["antiCheatMetadata"]
        meta_data = getattr(meta_arg, "data", meta_arg)
        assert meta_data["blur_count"] == 2
        assert meta_data["paste_count"] == 1

@pytest.mark.asyncio
async def test_run_evaluator_background_persistence():
    mock_eval = MagicMock()
    mock_eval.summary = "Screening summary"
    
    mock_cand = MagicMock()
    mock_cand.fitScore = 80.0
    mock_cand.name = "John Test"
    mock_cand.apiCost = 0.05
    mock_cand.campaign = MagicMock(jobDescription="Python Dev", evaluationStrictness="moderate")
    mock_cand.resume = None
    mock_cand.evaluation = mock_eval

    transcript = [
        {"role": "ai", "message": "What is Python?"},
        {
            "role": "candidate",
            "message": "Python is a dynamic programming language.",
            "telemetry": {"blur_count": 3, "paste_ratio": 0.4}
        }
    ]

    mock_report = EvaluationReport(
        overall_score=90.0,
        communication_score=88.0,
        technical_score=92.0,
        cultural_fit_score=90.0,
        strengths=["Good Python knowledge"],
        concerns=[],
        recommendation="shortlist",
        summary="Strong candidate",
        ai_generated_likelihood_score=25.0,
        anti_cheat_flags=[{"flag": "HIGH_PASTE_RATIO", "severity": "medium"}]
    )

    with patch("app.agent.api.prisma") as mock_prisma, \
         patch("app.agent.nodes.evaluator.evaluator_node", new_callable=AsyncMock) as mock_evaluator_node:
        
        mock_evaluator_node.return_value = {
            "evaluation_report": mock_report,
            "total_cost": 0.01
        }
        mock_prisma.evaluation.update = AsyncMock()
        mock_prisma.candidate.update = AsyncMock()

        await _run_evaluator_background("cand-eval-1", mock_cand, transcript)

        assert mock_prisma.evaluation.update.called
        data = mock_prisma.evaluation.update.call_args[1]["data"]
        assert data["aiGeneratedLikelihoodScore"] == 25.0
        
        flags_arg = data["antiCheatFlags"]
        flags_data = getattr(flags_arg, "data", flags_arg)
        assert flags_data[0]["flag"] == "HIGH_PASTE_RATIO"

        meta_arg = data["antiCheatMetadata"]
        meta_data = getattr(meta_arg, "data", meta_arg)
        assert meta_data["blur_count"] == 3
        assert "HIGH_PASTE_RATIO" in meta_data["flags"]

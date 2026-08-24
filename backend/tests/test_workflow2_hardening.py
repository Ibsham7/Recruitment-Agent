import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../")))

import pytest
import asyncio
from app.agent.schemas import normalize_telemetry
from app.agent.nodes.evaluator import analyze_anti_cheat_signals

def test_normalize_telemetry_safeguards():
    """Verify that normalize_telemetry handles invalid, null, string, percentage, and negative telemetry payloads gracefully."""
    
    # 1. Null / None input
    null_res = normalize_telemetry(None)
    assert null_res["blur_count"] == 0
    assert null_res["paste_ratio"] == 0.0
    assert null_res["flags"] == []

    # 2. String numbers & camelCase coercion
    camel_res = normalize_telemetry({
        "blurCount": "3",
        "focusDuration": "45.5",
        "pasteCount": "2",
        "totalPastedChars": "250",
        "totalAnswerChars": "500"
    })
    assert camel_res["blur_count"] == 3
    assert camel_res["focus_duration_seconds"] == 45.5
    assert camel_res["paste_count"] == 2
    assert camel_res["total_pasted_chars"] == 250
    assert camel_res["total_answer_chars"] == 500
    assert camel_res["paste_ratio"] == 0.5

    # 3. Percentage paste_ratio scaling (e.g. 75.0 passed instead of 0.75)
    pct_res = normalize_telemetry({
        "total_answer_chars": 100,
        "paste_ratio": 75.0
    })
    assert pct_res["paste_ratio"] == 0.75

    # 4. Negative values & division by zero guard
    zero_res = normalize_telemetry({
        "blur_count": -5,
        "total_answer_chars": 0,
        "total_pasted_chars": 100
    })
    assert zero_res["blur_count"] == 0
    assert zero_res["paste_ratio"] == 0.0

def test_anti_cheat_heuristic_signals():
    """Verify deterministic anti-cheat heuristic scoring on robotic formatting & telemetry flags."""
    answers = [
        "In summary, furthermore, to address your question, here is a breakdown of my experience:\n# Technical Role\n- Bullet 1\n- Bullet 2\n- Bullet 3\n- Bullet 4\n**Strong experience**",
        "As an AI, in conclusion, overall, additionally..."
    ]
    telemetry = {
        "blur_count": 5,
        "paste_count": 3,
        "total_pasted_chars": 6000,
        "total_answer_chars": 6500,
        "paste_ratio": 0.923
    }
    score, flags = analyze_anti_cheat_signals(answers, telemetry)
    assert score >= 70.0
    flag_names = [f["flag"] for f in flags]
    assert "MARKDOWN_OVERUSE" in flag_names
    assert "LLM_BOILERPLATE_TRANSITIONS" in flag_names
    assert "MASSIVE_PASTE_BLOB" in flag_names
    assert "FREQUENT_TAB_SWITCHES" in flag_names

if __name__ == "__main__":
    test_normalize_telemetry_safeguards()
    test_anti_cheat_heuristic_signals()
    print("ALL WORKFLOW 2 HARDENING TESTS PASSED SUCCESSFULLY!")

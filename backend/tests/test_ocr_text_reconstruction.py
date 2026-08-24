import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from app.agent.nodes.cv_parser import reconstruct_raw_text_from_profile

def test_reconstruct_raw_text_from_profile_produces_clean_prose():
    profile_data = {
        "name": "AYESHA RAHMAN",
        "current_role_resolved": "Senior Backend Engineer",
        "summary": "Backend engineer with 10+ years building high-throughput Python services.",
        "previous_roles": [
            {
                "title": "Senior Backend Engineer",
                "company": "Nexora Systems",
                "start_date": "March 2022",
                "end_date": "Present",
                "bullets": [
                    {"id": "E1.1", "text": "Designed and shipped 40+ FastAPI microservices handling 12M requests/day."},
                    {"id": "E1.2", "text": "Rebuilt PostgreSQL access layer."}
                ]
            }
        ],
        "skills": ["Python", "FastAPI", "PostgreSQL"],
        "education": [{"degree": "BS Computer Science", "institution": "FAST NUCES", "year": 2017}]
    }

    raw_text = reconstruct_raw_text_from_profile(profile_data)

    # Must NOT contain raw JSON syntax
    assert not raw_text.startswith("{")
    assert '"previous_roles":' not in raw_text

    # Must contain structured prose elements
    assert "AYESHA RAHMAN" in raw_text
    assert "Senior Backend Engineer" in raw_text
    assert "EXPERIENCE" in raw_text
    assert "- Designed and shipped 40+ FastAPI microservices handling 12M requests/day." in raw_text
    assert "EDUCATION" in raw_text
    assert "BS Computer Science, FAST NUCES, 2017" in raw_text
    assert "SKILLS" in raw_text
    assert "Python, FastAPI, PostgreSQL" in raw_text

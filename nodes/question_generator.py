# nodes/question_generator.py
import json
from config import get_model
from schemas import InterviewQuestion
from state import RecruitmentState
from langchain_core.messages import HumanMessage, SystemMessage

QUESTION_GEN_SYSTEM = """
You are an expert technical interviewer. Generate targeted interview questions 
based on the job description and the specific candidate's profile.

Questions should probe:
1. Technical skills claimed in the CV — are they real?
2. Experience gaps or missing requirements from the JD
3. Behavioral patterns relevant to the role
4. Situational judgment for scenarios common in this role

Return ONLY a JSON array of 3 questions:
[
  {
    "question": "The question to ask",
    "category": "technical" | "behavioral" | "situational",
    "what_to_look_for": "What a strong answer should include"
  }
]

Rules:
- No generic questions like "Tell me about yourself" or "Where do you see yourself in 5 years"
- Every question must be answerable by text (not whiteboard coding)
- Mix categories: ~1 technical, ~1 behavioral, ~1 situational
- Questions should be specific to THIS candidate's profile and THIS job
"""

def question_generator_node(state: RecruitmentState) -> dict:
    """Generate tailored interview questions."""

    profile = state.get("candidate_profile")
    screening = state.get("screening_result")
    jd = state.get("job_description")
    if profile is None:
        raise ValueError("candidate_profile is required for JD matching")
    if screening is None:
        raise ValueError("screening_result is required for JD matching")
    if jd is None:
        raise ValueError("job_description is required for JD matching")

    print(f"\n[Question Generator] Generating questions for: {getattr(profile, 'name', None)}")

    prompt = f"""
JOB DESCRIPTION:
{jd}

CANDIDATE:
Name: {profile.name}
Skills: {', '.join(profile.skills)}
Experience: {profile.total_experience_years} years in roles: {', '.join(profile.previous_roles)}
Missing requirements identified during screening: {', '.join(screening.missing_requirements)}

Generate 5 targeted interview questions for this specific candidate.
"""

    model = get_model("smart")
    response = model.invoke([
        SystemMessage(content=QUESTION_GEN_SYSTEM),
        HumanMessage(content=prompt)
    ])

    raw_json = response.content.strip().strip("```json").strip("```").strip() # type: ignore
    questions_data = json.loads(raw_json)
    questions = [InterviewQuestion(**q) for q in questions_data]

    return {
        "interview_questions": questions,
        "log": [f"Generated {len(questions)} interview questions"]
    }
# nodes/question_generator.py
import json
from app.agent.config import get_model
from app.agent.schemas import InterviewQuestion
from app.agent.state import RecruitmentState
from app.agent.utils import extract_json
from langchain_core.messages import HumanMessage, SystemMessage
from app.agent.prompts import QUESTION_GEN_SYSTEM


async def question_generator_node(state: RecruitmentState) -> dict:
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
"""

    custom_config = state.get("interview_config")
    if custom_config and custom_config.strip():
        prompt += f"\nTHE RECRUITER HAS PROVIDED THE FOLLOWING CUSTOM FOCUS AREAS / QUESTIONS:\n{custom_config.strip()}\n\nPlease ensure your generated questions prioritize addressing these focus areas while still adhering to the JSON format.\n"

    prompt += "\nGenerate 3 targeted interview questions for this specific candidate.\n"

    model = get_model("fast")
    max_retries = 3
    questions = []
    for attempt in range(max_retries):
        try:
            response = await model.ainvoke([
                SystemMessage(content=QUESTION_GEN_SYSTEM),
                HumanMessage(content=prompt)
            ])
            raw_json = extract_json(response.content)
            questions_data = json.loads(raw_json)
            questions = [InterviewQuestion(**q) for q in questions_data]
            break
        except Exception as e:
            print(f"  [Question Gen] Attempt {attempt+1} failed: {e}. Raw response: {getattr(response, 'content', 'None') if 'response' in locals() else 'None'}")
            if attempt == max_retries - 1:
                print(f"  [Question Gen] All {max_retries} attempts failed. Falling back to default questions.")
                questions = [
                    InterviewQuestion(
                        question="Could you tell us more about your background and experience?",
                        expected_aspects=["Clear communication", "Relevance to JD"],
                        purpose="General fallback question due to LLM error"
                    ),
                    InterviewQuestion(
                        question="What do you consider your greatest professional achievement?",
                        expected_aspects=["Impact", "Problem solving"],
                        purpose="General fallback question due to LLM error"
                    )
                ]

    return {
        "interview_questions": questions,
        "log": [f"Generated {len(questions)} interview questions"]
    }
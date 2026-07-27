# nodes/question_generator.py
import json
from app.agent.config import get_model
from app.agent.schemas import InterviewQuestion, InterviewQuestionList
from app.agent.state import RecruitmentState
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

    missing_reqs = [req.requirement for req in screening.must_have if req.match == "none"]
    prompt = f"""
JOB DESCRIPTION:
{jd}

CANDIDATE:
Name: {profile.name}
Skills: {', '.join(profile.skills)}
Experience: {profile.total_experience_years} years in roles: {', '.join(profile.previous_roles)}
Missing requirements identified during screening: {', '.join(missing_reqs)}
"""

    custom_config = state.get("interview_config")
    if custom_config and custom_config.strip():
        prompt += f"\nTHE RECRUITER HAS PROVIDED THE FOLLOWING CUSTOM FOCUS AREAS / QUESTIONS:\n{custom_config.strip()}\n\nPlease ensure your generated questions prioritize addressing these focus areas while still adhering to the JSON format.\n"

    prompt += "\nGenerate 3 targeted interview questions for this specific candidate.\n"

    max_retries = 3
    questions = []
    total_cost = 0.0
    for attempt in range(max_retries):
        model = get_model("fast", max_tokens=None)
        structured_model = model.with_structured_output(InterviewQuestionList, method="json_schema", include_raw=True)
        try:
            result = await structured_model.ainvoke([
                SystemMessage(content=QUESTION_GEN_SYSTEM),
                HumanMessage(content=prompt)
            ])
            parsed_res = result.get("parsed") if isinstance(result, dict) else None
            if not parsed_res:
                err = result.get("parsing_error") if isinstance(result, dict) else None
                raise ValueError(f"Failed to parse InterviewQuestionList: {err or 'LLM output was truncated or unparseable'}")
            questions = parsed_res.questions
            from app.agent.utils import extract_cost
            total_cost = extract_cost(result)
            break
        except Exception as e:
            print(f"  [Question Gen] Attempt {attempt+1} (fast) failed: {e}.")
            if attempt == max_retries - 1:
                print(f"  [Question Gen] All {max_retries} attempts failed. Falling back to default questions.")
                questions = [
                    InterviewQuestion(
                        question="Could you tell us more about your background and experience?",
                        category="behavioral",
                        what_to_look_for="Clear communication, Relevance to JD"
                    ),
                    InterviewQuestion(
                        question="What do you consider your greatest professional achievement?",
                        category="behavioral",
                        what_to_look_for="Impact, Problem solving"
                    )
                ]

    return {
        "interview_questions": questions,
        "log": [f"Generated {len(questions)} interview questions"],
        "total_cost": total_cost
    }
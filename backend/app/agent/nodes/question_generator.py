# nodes/question_generator.py
import json
from app.agent.config import get_model
from app.agent.schemas import InterviewQuestion, InterviewQuestionList
from app.agent.state import RecruitmentState
from langchain_core.messages import HumanMessage, SystemMessage
from app.agent.prompts import QUESTION_GEN_SYSTEM
from app.core.logging import logger


async def question_generator_node(state: RecruitmentState) -> dict:
    """Generate tailored, resume-anchored interview questions."""

    profile = state.get("candidate_profile")
    screening = state.get("screening_result")
    jd = state.get("job_description")
    if profile is None:
        raise ValueError("candidate_profile is required for JD matching")
    if screening is None:
        raise ValueError("screening_result is required for JD matching")
    if jd is None:
        raise ValueError("job_description is required for JD matching")

    logger.info(f"[Question Generator] Generating questions for: {getattr(profile, 'name', None)}")

    missing_reqs = [req.requirement for req in screening.must_have if req.match == "none"]
    
    roles_str = ", ".join(profile.previous_roles) if profile.previous_roles else "None specified"
    skills_str = ", ".join(profile.skills) if profile.skills else "None specified"
    projects_str = "\n  - ".join(profile.projects) if profile.projects else "None specified"
    achievements_str = "\n  - ".join(profile.key_achievements) if profile.key_achievements else "None specified"
    education_str = ", ".join(profile.education) if profile.education else "None specified"
    other_str = profile.other_info or "None"

    prompt = f"""JOB DESCRIPTION:
{jd}

CANDIDATE PROFILE (PARSED CV DETAILS):
Name: {profile.name}
Total Experience: {profile.total_experience_years} years
Previous Roles: {roles_str}
Skills & Technologies: {skills_str}
Projects:
  - {projects_str}
Key Achievements & Metrics:
  - {achievements_str}
Education: {education_str}
Other Info: {other_str}

IDENTIFIED SCREENING GAPS / MISSING REQUIREMENTS:
{', '.join(missing_reqs) if missing_reqs else 'None'}
"""

    custom_config = state.get("interview_config")
    if custom_config and custom_config.strip():
        prompt += f"\nTHE RECRUITER HAS PROVIDED THE FOLLOWING CUSTOM FOCUS AREAS / QUESTIONS:\n{custom_config.strip()}\n\nPlease ensure your generated questions prioritize addressing these focus areas while adhering to resume anchoring.\n"

    prompt += """
STRICT QUESTION GENERATION RULES (RESUME ANCHORING):
1. Every single question MUST be strictly anchored to specific candidate experience details from the parsed CV above (referencing exact roles, company/project names, tools/technologies, or achievements/metrics).
2. DO NOT ask generic behavioral questions like "Tell me about your background" or "What are your strengths".
3. Force hyper-specific, contextual prompts referencing candidate CV facts, e.g.:
   - "In your role at [Company/Project], you used [Tool/Tech] to achieve [Metric]. How did you handle..."
   - "While working on [Project Name], you utilized [Tool/Tech]. How did you scale..."
4. Ground questions in specific candidate tools, projects, company roles, technologies, and metrics mentioned in the parsed profile.

Generate 3 targeted, anchor-grounded interview questions for this specific candidate.
"""

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
            logger.warning(f"[Question Gen] Attempt {attempt+1} (fast) failed: {e}.")
            if attempt == max_retries - 1:
                logger.warning(f"[Question Gen] All {max_retries} attempts failed. Falling back to resume-anchored default questions.")
                role_ref = profile.previous_roles[0] if profile.previous_roles else "your recent role"
                skill_ref = profile.skills[0] if profile.skills else "your core technology"
                project_ref = profile.projects[0] if profile.projects else "your key project"
                questions = [
                    InterviewQuestion(
                        question=f"In your role at {role_ref}, you used {skill_ref} to deliver projects. How did you handle architectural trade-offs and technical challenges?",
                        category="technical",
                        what_to_look_for=f"Concrete technical trade-offs, depth with {skill_ref}, hands-on experience in {role_ref}"
                    ),
                    InterviewQuestion(
                        question=f"While working on {project_ref}, what specific metrics or outcomes did you achieve using {skill_ref}?",
                        category="behavioral",
                        what_to_look_for=f"Measurable achievements in {project_ref}, technical ownership, clear communication"
                    ),
                    InterviewQuestion(
                        question=f"Given your experience with {skill_ref} at {role_ref}, how would you approach the primary requirements described in this Job Description?",
                        category="situational",
                        what_to_look_for=f"Direct application of past experience to the target position requirements"
                    )
                ]

    return {
        "interview_questions": questions,
        "log": [f"Generated {len(questions)} interview questions"],
        "total_cost": total_cost
    }
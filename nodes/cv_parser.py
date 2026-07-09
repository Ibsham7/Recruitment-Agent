import json
from pypdf import PdfReader
from config import get_model
from schemas import CandidateProfile
from state import RecruitmentState
from langchain_core.messages import HumanMessage, SystemMessage

def extract_pdf_text(filepath: str) -> str:
    reader = PdfReader(filepath)
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n".join(pages)

#todo : can save token by adding raw cv text manually instead of sending to LLM
CV_PARSER_SYSTEM = """
You are a CV parsing expert. Extract structured information from the CV text provided.

Return ONLY valid JSON matching this exact schema — no markdown, no explanation:
{
  "name": "Full Name",
  "email": "email or null",
  "phone": "phone or null",
  "total_experience_years": 0.0,
  "education": ["Degree, Institution, Year"],
  "skills": ["skill1", "skill2"],
  "previous_roles": ["Job Title at Company (dates)"],
  "key_achievements": ["achievement1"],
  "raw_cv_text": "FULL TEXT HERE"
}

Rules:
- total_experience_years: calculate from dates if possible, estimate otherwise
- skills: include both technical (Python, SQL) and soft (leadership, communication)
- Do not invent information. If something is not in the CV, omit it or use null.
- raw_cv_text: include the complete extracted text exactly as provided.
"""

def cv_parser_node(state: RecruitmentState) -> dict:
    """Parse a CV PDF into a structured CandidateProfile."""
    print(f"\n[CV Parser] Processing: {state['cv_filepath']}")

    raw_text = extract_pdf_text(state["cv_filepath"])

    model = get_model("smart")
    response = model.invoke([
        SystemMessage(content=CV_PARSER_SYSTEM),
        HumanMessage(content=f"Parse this CV:\n\n{raw_text}")
    ])

    raw_json = response.content.strip().strip("```json").strip("```").strip() # type: ignore

    # Validate with Pydantic — raises ValidationError if model output is malformed
    profile_data = json.loads(raw_json)
    profile_data["raw_cv_text"] = raw_text   # ensure full text is always included
    candidate_profile = CandidateProfile(**profile_data)

    return {
        "candidate_profile": candidate_profile,
        "pipeline_status": "running",
        "log": [f"CV parsed: {candidate_profile.name}, {candidate_profile.total_experience_years} yrs exp"]
    }
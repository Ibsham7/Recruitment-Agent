import json
import os
import tempfile
import urllib.request
from pypdf import PdfReader
from app.agent.config import get_model
from app.agent.schemas import CandidateProfile
from app.agent.state import RecruitmentState
from langchain_core.messages import HumanMessage, SystemMessage
import asyncio
from prisma import Prisma
from app.agent.utils import extract_json

def extract_pdf_text(filepath: str) -> str:
    temp_path = None
    if filepath.startswith("http://") or filepath.startswith("https://"):
        fd, temp_path = tempfile.mkstemp(suffix=".pdf")
        os.close(fd)
        urllib.request.urlretrieve(filepath, temp_path)
        pdf_path = temp_path
    else:
        pdf_path = filepath

    try:
        reader = PdfReader(pdf_path)
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n".join(pages)
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

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

async def cv_parser_node(state: RecruitmentState) -> dict:
    """Parse a CV PDF into a structured CandidateProfile."""
    print(f"\n[CV Parser] Processing: {state['cv_filepath']}")

    # If profile is already in state (cached), skip parsing
    if state.get("candidate_profile"):
        print("  [OK] Using cached profile.")
        return {
            "pipeline_status": "running",
            "log": ["CV parsed from cache"]
        }

    raw_text = extract_pdf_text(state["cv_filepath"])
    
    # Parse via LLM
    model = get_model("fast")
    response = await model.ainvoke([
        SystemMessage(content=CV_PARSER_SYSTEM),
        HumanMessage(content=f"Parse this CV:\n\n{raw_text}")
    ])
    
    raw_json = extract_json(response.content)
    profile_data = json.loads(raw_json)
    profile_data["raw_cv_text"] = raw_text
    
    candidate_profile = CandidateProfile(**profile_data)

    return {
        "candidate_profile": candidate_profile,
        "pipeline_status": "running",
        "log": [f"CV parsed: {candidate_profile.name}, {candidate_profile.total_experience_years} yrs exp"]
    }
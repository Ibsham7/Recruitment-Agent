import json
import os
import tempfile
import urllib.request
from pypdf import PdfReader
from config import get_model
from schemas import CandidateProfile
from state import RecruitmentState
from langchain_core.messages import HumanMessage, SystemMessage
import asyncio
from prisma import Prisma

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

def _get_or_create_profile_sync(cv_filepath: str, raw_text: str) -> CandidateProfile:
    async def _async_task():
        prisma = Prisma()
        await prisma.connect()
        try:
            # Check if candidate with this resume path exists and has structuredProfile
            candidate = await prisma.candidate.find_first(
                where={"resumePath": cv_filepath}
            )
            
            if candidate and candidate.structuredProfile:
                # Return cached profile
                # Check if it's a string or dict (Prisma Json field returns python types, usually dict/list)
                profile_data = candidate.structuredProfile
                if isinstance(profile_data, str):
                    profile_data = json.loads(profile_data)
                return CandidateProfile(**profile_data) # type: ignore
            
            # Not cached, parse via LLM
            model = get_model("fast")
            response = model.invoke([
                SystemMessage(content=CV_PARSER_SYSTEM),
                HumanMessage(content=f"Parse this CV:\n\n{raw_text}")
            ])
            
            raw_json = response.content.strip().strip("```json").strip("```").strip() # type: ignore
            profile_data = json.loads(raw_json)
            profile_data["raw_cv_text"] = raw_text
            
            # Save to DB if candidate exists
            if candidate:
                await prisma.candidate.update(
                    where={"id": candidate.id},
                    data={"structuredProfile": json.dumps(profile_data)}
                )
            
            return CandidateProfile(**profile_data)
        finally:
            await prisma.disconnect()
            
    return asyncio.run(_async_task())

def cv_parser_node(state: RecruitmentState) -> dict:
    """Parse a CV PDF into a structured CandidateProfile."""
    print(f"\n[CV Parser] Processing: {state['cv_filepath']}")

    raw_text = extract_pdf_text(state["cv_filepath"])
    
    candidate_profile = _get_or_create_profile_sync(state["cv_filepath"], raw_text)

    return {
        "candidate_profile": candidate_profile,
        "pipeline_status": "running",
        "log": [f"CV parsed: {candidate_profile.name}, {candidate_profile.total_experience_years} yrs exp"]
    }
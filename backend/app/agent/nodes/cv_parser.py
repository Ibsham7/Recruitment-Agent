import json
import os
import tempfile
import urllib.request
import hashlib
from pypdf import PdfReader
from app.agent.config import get_model
from app.agent.schemas import CandidateProfile
from app.agent.state import RecruitmentState
from langchain_core.messages import HumanMessage, SystemMessage
import asyncio
from app.database import prisma
from app.agent.utils import extract_json

import httpx

async def extract_pdf_text(filepath: str) -> str:
    temp_path = None
    if filepath.startswith("http://") or filepath.startswith("https://"):
        fd, temp_path = tempfile.mkstemp(suffix=".pdf")
        os.close(fd)
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(filepath, timeout=30.0, follow_redirects=True)
                response.raise_for_status()
                with open(temp_path, "wb") as f:
                    f.write(response.content)
            pdf_path = temp_path
        except Exception as e:
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)
            raise e
    else:
        pdf_path = filepath

    try:
        def read_pdf():
            reader = PdfReader(pdf_path)
            return "\n".join([page.extract_text() or "" for page in reader.pages])
        
        return await asyncio.to_thread(read_pdf)
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

#todo : can save token by adding raw cv text manually instead of sending to LLM
CV_PARSER_SYSTEM = """
You are a CV parsing expert. Extract structured information from the CV text provided.

Return ONLY a valid JSON object matching this exact schema. Do NOT wrap it in ```json code blocks. Do NOT include any conversational text before or after the JSON:
{
  "name": "Full Name",
  "email": "email or null",
  "phone": "phone or null",
  "experience_calculation": "Step-by-step calculation: Role A (Jan 2020 - Jan 2022) = 24 months. Total = 24 months / 12 = 2.0 years",
  "total_experience_years": 0.0,
  "education": ["Degree, Institution, Year"],
  "skills": ["skill1", "skill2"],
  "previous_roles": ["Job Title at Company (dates)"],
  "key_achievements": ["achievement1"],
  "projects": ["Project Name: Description"],
  "other_info": "Any other relevant info from the CV or null"
}

Rules:
- total_experience_years: calculate from dates if possible, estimate otherwise
- skills: include both technical (Python, SQL) and soft (leadership, communication)
- projects: include notable academic, personal or professional projects
- other_info: include anything else that is relevant like certifications, awards, etc.
- Do not invent information. If something is not in the CV, omit it or use null.
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

    raw_text = await extract_pdf_text(state["cv_filepath"])
    file_hash = hashlib.sha256(raw_text.encode('utf-8')).hexdigest()
    
    # Check global Resume cache by hash
    resume = await prisma.resume.find_unique(where={"fileHash": file_hash})
    if resume and resume.structuredProfile:
        print("  [OK] Found global resume cache via hash.")
        profile_data = json.loads(resume.structuredProfile) if isinstance(resume.structuredProfile, str) else resume.structuredProfile
        candidate_profile = CandidateProfile(**profile_data)
        
        # Link candidate to existing resume
        if "candidate_id" in state and not state["candidate_id"].startswith("candidate_"):
            # Only update if it's a real database UUID (not local dummy string)
            try:
                await prisma.candidate.update(
                    where={"id": state["candidate_id"]},
                    data={"resumeId": resume.id}
                )
            except Exception as e:
                print(f"  [Warning] Could not link resume to candidate: {e}")
                
        return {
            "candidate_profile": candidate_profile,
            "pipeline_status": "running",
            "log": ["CV parsed from global hash cache"]
        }

    # Not found, parse via LLM
    model = get_model("fast")
    max_retries = 3
    profile_data = None
    for attempt in range(max_retries):
        try:
            response = await model.ainvoke([
                SystemMessage(content=CV_PARSER_SYSTEM),
                HumanMessage(content=f"Parse this CV:\n\n{raw_text}")
            ])
            raw_json = extract_json(response.content)
            profile_data = json.loads(raw_json)
            break
        except Exception as e:
            print(f"  [CV Parser] Attempt {attempt+1} failed: {e}. Raw response: {getattr(response, 'content', 'None') if 'response' in locals() else 'None'}")
            if attempt == max_retries - 1:
                print(f"  [CV Parser] All {max_retries} attempts failed. Falling back to unknown candidate.")
                profile_data = {
                    "name": "Unknown Candidate (Parse Failed)",
                    "skills": [],
                    "total_experience_years": 0.0,
                    "previous_roles": [],
                    "education": [],
                    "projects": [],
                    "other_info": f"Failed to parse CV after {max_retries} attempts due to LLM degradation. Raw CV length: {len(raw_text)} chars"
                }
    
    if not profile_data.get("name"):
        profile_data["name"] = "Unknown Candidate"
        
    profile_data["raw_cv_text"] = raw_text
    
    candidate_profile = CandidateProfile(**profile_data)

    # Create new global Resume record
    new_resume = await prisma.resume.create(
        data={
            "fileHash": file_hash,
            "rawCvText": raw_text,
            "structuredProfile": json.dumps(profile_data)
        }
    )
    
    # Link candidate
    if "candidate_id" in state and not state["candidate_id"].startswith("candidate_"):
        try:
            await prisma.candidate.update(
                where={"id": state["candidate_id"]},
                data={"resumeId": new_resume.id}
            )
        except Exception as e:
            print(f"  [Warning] Could not link new resume to candidate: {e}")

    return {
        "candidate_profile": candidate_profile,
        "pipeline_status": "running",
        "log": [f"CV parsed: {candidate_profile.name}, {candidate_profile.total_experience_years} yrs exp"]
    }
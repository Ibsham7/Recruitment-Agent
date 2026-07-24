import json
import os
import tempfile
import urllib.request
import hashlib
import base64
from pypdf import PdfReader
from app.agent.config import get_model
from app.agent.schemas import CandidateProfile, CandidateProfileOutput
from app.agent.state import RecruitmentState
from langchain_core.messages import HumanMessage, SystemMessage
from app.agent.prompts import CV_PARSER_SYSTEM
import asyncio
from app.database import prisma
from typing import Tuple, Optional, Dict

import httpx

try:
    import fitz
except ImportError:
    fitz = None


async def extract_pdf_text(filepath: str) -> Tuple[str, Optional[Dict], float]:
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
        
        text = await asyncio.to_thread(read_pdf)
        
        # Trigger OCR fallback if PyPDF2 extracts virtually no text
        if len(text.strip()) < 50:
            print("  [CV Parser] Standard text extraction failed or returned too little text. Falling back to OCR.")
            profile_data, cost = await ocr_pdf_fallback(pdf_path)
            raw_text = json.dumps(profile_data, sort_keys=True) if profile_data else text
            return raw_text, profile_data, cost
            
        return text, None, 0.0
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

async def ocr_pdf_fallback(pdf_path: str) -> Tuple[Optional[Dict], float]:
    """Fallback method that converts PDF pages to images and uses a Vision model to extract directly to JSON."""
    print(f"  [OCR Fallback] Initiating Vision OCR for {pdf_path}...")
    if not fitz:
        print("  [OCR Fallback] PyMuPDF (fitz) is not installed. Cannot perform OCR.")
        return None, 0.0
        
    try:
        def process_pdf():
            doc = fitz.open(pdf_path)
            base64_images = []
            for page in doc:
                pix = page.get_pixmap(dpi=150)
                img_data = pix.tobytes("jpeg")
                b64 = base64.b64encode(img_data).decode("utf-8")
                base64_images.append(b64)
            doc.close()
            return base64_images

        base64_images = await asyncio.to_thread(process_pdf)
        
        ocr_prompt = CV_PARSER_SYSTEM + "\n\n" + (
            "You are an expert OCR system specialized in reading Curriculum Vitae (CV) and resumes. "
            "Extract all information from the provided image(s) of a CV directly into the required JSON format as specified by the schema above. "
            "Ensure all extracted information aligns precisely with the schema."
        )
        content_parts = [{"type": "text", "text": ocr_prompt}]
        for b64 in base64_images:
            content_parts.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{b64}"}
            })
            
        model = get_model("ocr")
        structured_model = model.with_structured_output(CandidateProfileOutput, method="json_schema", include_raw=True)
        result = await structured_model.ainvoke([HumanMessage(content=content_parts)])
        print(f"  [OCR Fallback] Successfully parsed JSON via Vision OCR.")
        from app.agent.utils import extract_cost
        cost = extract_cost(result)
        profile_data = result["parsed"].model_dump()
        return profile_data, cost

    except Exception as e:
        print(f"  [OCR Fallback] Failed: {e}")
        return None, 0.0

#todo : can save token by adding raw cv text manually instead of sending to LLM

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

    raw_text, pre_parsed_profile, total_cost = await extract_pdf_text(state["cv_filepath"])
    file_hash = hashlib.sha256(raw_text.encode('utf-8')).hexdigest()
    
    # Check global Resume cache by hash if DB is connected
    resume = None
    if prisma.is_connected():
        try:
            resume = await prisma.resume.find_unique(where={"fileHash": file_hash})
        except Exception:
            resume = None

    if resume and resume.structuredProfile:
        print("  [OK] Found global resume cache via hash.")
        profile_data = json.loads(resume.structuredProfile) if isinstance(resume.structuredProfile, str) else resume.structuredProfile
        candidate_profile = CandidateProfile(**profile_data)
        
        # Link candidate to existing resume
        if "candidate_id" in state and not state["candidate_id"].startswith("candidate_") and prisma.is_connected():
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
            "log": ["CV parsed from global hash cache"],
            "total_cost": total_cost
        }

    if pre_parsed_profile:
        print("  [OK] Using directly parsed profile from Vision OCR.")
        profile_data = pre_parsed_profile
    else:
        # Not found, parse via LLM
        model = get_model("fast")
        structured_model = model.with_structured_output(CandidateProfileOutput, method="json_schema", include_raw=True)
        max_retries = 3
        profile_data = None
        for attempt in range(max_retries):
            try:
                result = await structured_model.ainvoke([
                    SystemMessage(content=CV_PARSER_SYSTEM),
                    HumanMessage(content=f"Parse this CV:\n\n{raw_text}")
                ])
                from app.agent.utils import extract_cost
                total_cost += extract_cost(result)
                profile_data = result["parsed"].model_dump()
                break
            except Exception as e:
                print(f"  [CV Parser] Attempt {attempt+1} failed: {e}.")
                if attempt == max_retries - 1:
                    raise RuntimeError(f"Failed to parse CV after {max_retries} attempts due to LLM failure: {e}")
    
    if not profile_data.get("name"):
        profile_data["name"] = "Unknown Candidate"
        
    profile_data["raw_cv_text"] = raw_text
    
    # Ensure required fields have defaults
    if "skills" not in profile_data:
        profile_data["skills"] = []
    if "previous_roles" not in profile_data:
        profile_data["previous_roles"] = []
    if "education" not in profile_data:
        profile_data["education"] = []
    if "projects" not in profile_data:
        profile_data["projects"] = []

    # Apply deterministic TimelineCalculator to merge non-overlapping employment intervals
    from app.agent.tools.timeline import calculate_total_experience_years
    llm_exp = profile_data.get("total_experience_years", 0.0)
    profile_data["total_experience_years"] = calculate_total_experience_years(
        profile_data.get("previous_roles", []),
        fallback_years=float(llm_exp) if llm_exp else 0.0
    )
        
    candidate_profile = CandidateProfile(**profile_data)

    # Create new global Resume record if DB is connected
    if prisma.is_connected():
        try:
            new_resume = await prisma.resume.create(
                data={
                    "fileHash": file_hash,
                    "rawCvText": raw_text,
                    "structuredProfile": json.dumps(profile_data, sort_keys=True)
                }
            )
            
            # Link candidate
            if "candidate_id" in state and not state["candidate_id"].startswith("candidate_"):
                await prisma.candidate.update(
                    where={"id": state["candidate_id"]},
                    data={"resumeId": new_resume.id}
                )
        except Exception as e:
            print(f"  [Warning] DB save failed in cv_parser: {e}")
            print(f"  [Warning] Could not link new resume to candidate: {e}")

    return {
        "candidate_profile": candidate_profile,
        "pipeline_status": "running",
        "log": [f"CV parsed: {candidate_profile.name}, {candidate_profile.total_experience_years} yrs exp"],
        "total_cost": total_cost
    }
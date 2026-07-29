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
from app.agent.utils import clean_surrogates, extract_json, extract_cost
import asyncio
from app.database import prisma
from typing import Tuple, Optional, Dict

import httpx

try:
    import fitz
except ImportError:
    fitz = None


from urllib.parse import urlparse
import re

def parse_file_by_format(local_path: str) -> str:
    """Synchronous helper to parse PDF, DOCX, DOC, or TXT file into raw text."""
    header = b""
    try:
        with open(local_path, "rb") as f:
            header = f.read(8)
    except Exception as e:
        print(f"  [CV Parser] Error reading header: {e}")

    # 1. PDF format (%PDF)
    if header.startswith(b"%PDF"):
        try:
            reader = PdfReader(local_path)
            return "\n".join([page.extract_text() or "" for page in reader.pages])
        except Exception as e:
            print(f"  [CV Parser] PdfReader failed: {e}")
            return ""

    # 2. DOCX format (ZIP header PK\x03\x04)
    if header.startswith(b"PK\x03\x04"):
        try:
            import docx
            doc = docx.Document(local_path)
            full_text = [p.text for p in doc.paragraphs if p.text]
            for table in doc.tables:
                for row in table.rows:
                    for cell in row.cells:
                        if cell.text:
                            full_text.append(cell.text)
            return "\n".join(full_text)
        except Exception as e:
            print(f"  [CV Parser] python-docx failed: {e}")
        
        try:
            import zipfile
            import xml.etree.ElementTree as ET
            with zipfile.ZipFile(local_path) as z:
                xml_content = z.read('word/document.xml')
            tree = ET.fromstring(xml_content)
            texts = []
            for elem in tree.iter():
                if elem.tag.endswith('t') and elem.text:
                    texts.append(elem.text)
                elif elem.tag.endswith('p'):
                    texts.append('\n')
            return "".join(texts)
        except Exception as e:
            print(f"  [CV Parser] zipfile docx parsing failed: {e}")
            return ""

    # 3. DOC format (OLE CFBF header \xd0\xcf\x11\xe0)
    if header.startswith(b"\xd0\xcf\x11\xe0"):
        try:
            with open(local_path, "rb") as f:
                content = f.read()
            text_runs = re.findall(rb'[\x20-\x7E\t\r\n]{4,}', content)
            decoded = [run.decode('ascii', errors='ignore') for run in text_runs]
            filtered = [t for t in decoded if not t.startswith("Root Entry") and not t.startswith("WordDocument")]
            return "\n".join(filtered)
        except Exception as e:
            print(f"  [CV Parser] DOC parsing failed: {e}")
            return ""

    # 4. Text / Fallback file
    try:
        with open(local_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except Exception as e:
        print(f"  [CV Parser] Text reading failed: {e}")
        return ""

async def extract_pdf_text(filepath: str) -> Tuple[str, Optional[Dict], float]:
    temp_path = None
    if filepath.startswith("http://") or filepath.startswith("https://"):
        parsed = urlparse(filepath)
        ext = os.path.splitext(parsed.path)[1].lower() or ".pdf"
        fd, temp_path = tempfile.mkstemp(suffix=ext)
        os.close(fd)
        max_retries = 3
        last_exception = None
        for attempt in range(1, max_retries + 1):
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(filepath, timeout=30.0, follow_redirects=True)
                    response.raise_for_status()
                    with open(temp_path, "wb") as f:
                        f.write(response.content)
                local_path = temp_path
                last_exception = None
                break
            except Exception as e:
                last_exception = e
                print(f"  [CV Parser] Download attempt {attempt}/{max_retries} failed for {filepath}: {e}")
                if attempt < max_retries:
                    await asyncio.sleep(1.5 * attempt)
        
        if last_exception is not None:
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)
            raise last_exception
    else:
        local_path = filepath

    try:
        text = await asyncio.to_thread(parse_file_by_format, local_path)
        text = clean_surrogates(text)
        
        # Trigger OCR fallback if standard text extraction returned too little text
        if len(text.strip()) < 50:
            print("  [CV Parser] Standard text extraction failed or returned too little text. Falling back to OCR.")
            profile_data, cost = await ocr_pdf_fallback(local_path)
            raw_text = clean_surrogates(json.dumps(profile_data, sort_keys=True)) if profile_data else text
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
            
        model = get_model("ocr", max_tokens=8192)
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
    raw_text = clean_surrogates(raw_text)
    file_hash = hashlib.sha256(raw_text.encode('utf-8', errors='replace')).hexdigest()
    
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
        # Tiered escalation: Attempt 1 uses fast tier with full 8K token budget; Attempt 2 escalates to smart tier safety net
        model_escalation = [
            ("fast", 8192),
            ("smart", 8192),
        ]
        profile_data = None
        for attempt, (tier, token_limit) in enumerate(model_escalation):
            model = get_model(tier, max_tokens=token_limit)
            structured_model = model.with_structured_output(CandidateProfileOutput, method="json_schema", include_raw=True)
            try:
                try:
                    result = await structured_model.ainvoke([
                        SystemMessage(content=CV_PARSER_SYSTEM),
                        HumanMessage(content=f"Parse this CV:\n\n{raw_text}")
                    ])
                    parsed_res = result.get("parsed") if isinstance(result, dict) else None
                    if not parsed_res and isinstance(result, dict):
                        raw_msg = result.get("raw")
                        raw_str = raw_msg.content if hasattr(raw_msg, "content") else (str(raw_msg) if raw_msg else None)
                        if raw_str:
                            extracted = extract_json(raw_str)
                            parsed_dict = json.loads(extracted)
                            parsed_res = CandidateProfileOutput.model_validate(parsed_dict)
                    if parsed_res:
                        total_cost += extract_cost(result)
                        profile_data = parsed_res.model_dump()
                        break
                except Exception as inner_e:
                    print(f"  [CV Parser] Structured output attempt {attempt+1} ({tier}) failed ({inner_e}). Trying fallback raw JSON parsing...")
                    raw_resp = await model.ainvoke([
                        SystemMessage(content=CV_PARSER_SYSTEM + "\nOutput a single valid JSON object matching the CandidateProfileOutput schema."),
                        HumanMessage(content=f"Parse this CV:\n\n{raw_text}")
                    ])
                    extracted = extract_json(raw_resp.content)
                    parsed_dict = json.loads(extracted)
                    parsed_res = CandidateProfileOutput.model_validate(parsed_dict)
                    total_cost += extract_cost(raw_resp)
                    profile_data = parsed_res.model_dump()
                    break
            except Exception as e:
                print(f"  [CV Parser] Attempt {attempt+1} ({tier}, max_tokens={token_limit}) failed: {e}.")
                if attempt == len(model_escalation) - 1:
                    raise RuntimeError(f"Failed to parse CV after {len(model_escalation)} attempts due to LLM failure: {e}")
    
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
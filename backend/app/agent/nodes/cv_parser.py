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
from app.agent.utils import clean_surrogates, extract_json, extract_cost_and_tokens
from datetime import date
import asyncio
from app.database import prisma
from app.core.logging import logger
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
        logger.warning(f"[CV Parser] Error reading header: {e}")

    # 1. PDF format (%PDF)
    if header.startswith(b"%PDF"):
        try:
            reader = PdfReader(local_path)
            return "\n".join([page.extract_text() or "" for page in reader.pages])
        except Exception as e:
            logger.warning(f"[CV Parser] PdfReader failed: {e}")
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
            logger.warning(f"[CV Parser] python-docx failed: {e}")
        
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
            logger.warning(f"[CV Parser] zipfile docx parsing failed: {e}")
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
            logger.warning(f"[CV Parser] DOC parsing failed: {e}")
            return ""

    # 4. Text / Fallback file
    try:
        with open(local_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except Exception as e:
        logger.warning(f"[CV Parser] Text reading failed: {e}")
        return ""

async def extract_pdf_text(filepath: str) -> Tuple[str, Optional[Dict], float, Dict]:
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
                logger.warning(f"[CV Parser] Download attempt {attempt}/{max_retries} failed for {filepath}: {e}")
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
        
        # Check header to see if it's actually a PDF before running OCR fallback
        is_pdf = False
        try:
            with open(local_path, "rb") as f:
                is_pdf = f.read(4).startswith(b"%PDF")
        except Exception:
            pass

        # Trigger OCR fallback if standard text extraction returned too little text and file is a PDF
        if len(text.strip()) < 50 and is_pdf:
            logger.info("[CV Parser] Standard text extraction failed or returned too little text on PDF. Falling back to OCR.")
            profile_data, cost, tokens = await ocr_pdf_fallback(local_path)
            raw_text = clean_surrogates(json.dumps(profile_data, sort_keys=True)) if profile_data else text
            return raw_text, profile_data, cost, tokens or {}
            
        return text, None, 0.0, {}
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


async def ocr_pdf_fallback(pdf_path: str) -> Tuple[Optional[Dict], float, Dict]:
    """Fallback method that converts PDF pages to images and uses a Vision model to extract directly to JSON."""
    logger.info(f"[OCR Fallback] Initiating Vision OCR for {pdf_path}...")
    if not fitz:
        logger.warning("[OCR Fallback] PyMuPDF (fitz) is not installed. Cannot perform OCR.")
        return None, 0.0, {}
        
    try:
        def process_pdf():
            doc = fitz.open(pdf_path)
            base64_images = []
            for i, page in enumerate(doc):
                if i >= 3:
                    logger.info(f"[OCR Fallback] Max page limit reached (3 pages). Skipping remaining {len(doc) - 3} pages for cost optimization.")
                    break
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
        logger.info("[OCR Fallback] Successfully parsed JSON via Vision OCR.")
        cost, token_info = extract_cost_and_tokens(result, model_name="google/gemini-2.5-flash-lite")
        profile_data = result["parsed"].model_dump()
        return profile_data, cost, token_info

    except Exception as e:
        logger.error(f"[OCR Fallback] Failed: {e}")
        return None, 0.0, {}


#todo : can save token by adding raw cv text manually instead of sending to LLM

async def cv_parser_node(state: RecruitmentState) -> dict:
    """Parse a CV PDF into a structured CandidateProfile."""
    logger.info(f"[CV Parser] Processing: {state['cv_filepath']}")

    # If profile is already in state (cached), skip parsing
    if state.get("candidate_profile"):
        logger.info("[CV Parser] Using cached profile.")
        return {
            "pipeline_status": "running",
            "log": ["CV parsed from cache"]
        }

    raw_text, pre_parsed_profile, total_cost, ocr_tokens = await extract_pdf_text(state["cv_filepath"])
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
        logger.info("[CV Parser] Found global resume cache via hash.")
        profile_data = json.loads(resume.structuredProfile) if isinstance(resume.structuredProfile, str) else resume.structuredProfile
        
        # Dynamically recalculate tenure & calculation summary against live current date
        from app.agent.tools.timeline import calculate_total_experience_years, generate_experience_calculation_summary
        llm_exp = profile_data.get("total_experience_years", 0.0)
        profile_data["total_experience_years"] = calculate_total_experience_years(
            profile_data.get("previous_roles", []),
            fallback_years=float(llm_exp) if llm_exp else 0.0
        )
        profile_data["experience_calculation"] = generate_experience_calculation_summary(
            profile_data.get("previous_roles", [])
        )
        candidate_profile = CandidateProfile(**profile_data)
        
        # Link candidate to existing resume & update extracted name
        if "candidate_id" in state and not state["candidate_id"].startswith("candidate_") and prisma.is_connected():
            try:
                update_data = {"resumeId": resume.id}
                if candidate_profile.name and candidate_profile.name not in ["Unknown Candidate", "Processing Candidate..."]:
                    update_data["name"] = candidate_profile.name
                await prisma.candidate.update(
                    where={"id": state["candidate_id"]},
                    data=update_data
                )
            except Exception as e:
                logger.warning(f"[CV Parser] Could not link resume to candidate: {e}")
                
        return {
            "candidate_profile": candidate_profile,
            "pipeline_status": "running",
            "log": ["CV parsed from global hash cache"],
            "total_cost": total_cost
        }

    stage_tokens = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
    today_str = date.today().isoformat()
    cv_parser_prompt = CV_PARSER_SYSTEM.format(current_date=today_str)

    if pre_parsed_profile:
        logger.info("[CV Parser] Using directly parsed profile from Vision OCR.")
        profile_data = pre_parsed_profile
        if ocr_tokens:
            stage_tokens["input_tokens"] += ocr_tokens.get("input_tokens", 0)
            stage_tokens["output_tokens"] += ocr_tokens.get("output_tokens", 0)
            stage_tokens["total_tokens"] += ocr_tokens.get("total_tokens", 0)
    else:
        # Tiered escalation: Attempt 1 uses fast tier with full 8K token budget; Attempt 2 escalates to smart tier safety net
        model_escalation = [
            ("fast", 8192),
            ("smart", 8192),
        ]
        profile_data = None
        for attempt, (tier, token_limit) in enumerate(model_escalation):
            model_name = "google/gemini-2.5-flash-lite" if tier == "fast" else "google/gemini-2.5-flash"
            model = get_model(tier, max_tokens=token_limit)
            structured_model = model.with_structured_output(CandidateProfileOutput, method="json_schema", include_raw=True)
            try:
                try:
                    result = await structured_model.ainvoke([
                        SystemMessage(content=cv_parser_prompt),
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
                        call_cost, token_info = extract_cost_and_tokens(result, model_name=model_name)
                        total_cost += call_cost
                        stage_tokens["input_tokens"] += token_info.get("input_tokens", 0)
                        stage_tokens["output_tokens"] += token_info.get("output_tokens", 0)
                        stage_tokens["total_tokens"] += token_info.get("total_tokens", 0)
                        profile_data = parsed_res.model_dump()
                        break
                except Exception as inner_e:
                    logger.warning(f"[CV Parser] Structured output attempt {attempt+1} ({tier}) failed ({inner_e}). Trying fallback raw JSON parsing...")
                    raw_resp = await model.ainvoke([
                        SystemMessage(content=cv_parser_prompt + "\nOutput a single valid JSON object matching the CandidateProfileOutput schema."),
                        HumanMessage(content=f"Parse this CV:\n\n{raw_text}")
                    ])
                    extracted = extract_json(raw_resp.content)
                    parsed_dict = json.loads(extracted)
                    parsed_res = CandidateProfileOutput.model_validate(parsed_dict)
                    call_cost, token_info = extract_cost_and_tokens(raw_resp, model_name=model_name)
                    total_cost += call_cost
                    stage_tokens["input_tokens"] += token_info.get("input_tokens", 0)
                    stage_tokens["output_tokens"] += token_info.get("output_tokens", 0)
                    stage_tokens["total_tokens"] += token_info.get("total_tokens", 0)
                    profile_data = parsed_res.model_dump()
                    break
            except Exception as e:
                logger.warning(f"[CV Parser] Attempt {attempt+1} ({tier}, max_tokens={token_limit}) failed: {e}.")
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
    from app.agent.tools.timeline import calculate_total_experience_years, generate_experience_calculation_summary
    llm_exp = profile_data.get("total_experience_years", 0.0)
    profile_data["total_experience_years"] = calculate_total_experience_years(
        profile_data.get("previous_roles", []),
        fallback_years=float(llm_exp) if llm_exp else 0.0
    )
    profile_data["experience_calculation"] = generate_experience_calculation_summary(
        profile_data.get("previous_roles", [])
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
            
            # Link candidate & update extracted name
            if "candidate_id" in state and not state["candidate_id"].startswith("candidate_"):
                update_data = {"resumeId": new_resume.id}
                if candidate_profile.name and candidate_profile.name not in ["Unknown Candidate", "Processing Candidate..."]:
                    update_data["name"] = candidate_profile.name
                await prisma.candidate.update(
                    where={"id": state["candidate_id"]},
                    data=update_data
                )
        except Exception as e:
            logger.warning(f"[CV Parser] DB save failed: {e}")
            logger.warning(f"[CV Parser] Could not link new resume to candidate: {e}")

    return {
        "candidate_profile": candidate_profile,
        "pipeline_status": "running",
        "log": [f"CV parsed: {candidate_profile.name}, {candidate_profile.total_experience_years} yrs exp"],
        "total_cost": round(total_cost, 6),
        "stage_costs": {
            "cv_parser": {
                "cost": round(total_cost, 6),
                "tokens": stage_tokens
            }
        }
    }
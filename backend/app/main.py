from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
import asyncio
import os
import sys
import ssl

# Ensure stdout and stderr handle UTF-8 cleanly on Windows standard console
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
        sys.stderr.reconfigure(encoding="utf-8", errors="backslashreplace")
    except Exception:
        pass

if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:
        pass

from app.agent.api import start_candidate_pipeline, resume_pipeline, generate_on_demand_questions, process_interview_answer
from app.agent.schemas import normalize_telemetry
from app.database import prisma, init_db_pool, close_db_pool
from app.agent.embeddings import _distill_jd_async, get_embedding_async
from app.security import verify_jwt
from app.interview_security import generate_interview_token, verify_interview_token
from app.services.email_service import send_interview_invitation_email
import datetime
from fastapi import Depends
from arq import create_pool
from arq.connections import RedisSettings

def _get_redis_settings() -> RedisSettings:
    url = os.getenv("REDIS_URL", "redis://localhost:6379")
    settings = RedisSettings.from_dsn(url)
    settings.conn_timeout = 10
    settings.conn_retries = 5
    if url.startswith("rediss://"):
        settings.ssl_cert_reqs = "none"
    return settings

async def lifespan(app: FastAPI):
    # Startup: Connect to database, initialize psycopg connection pool and Redis Queue
    await prisma.connect()
    await init_db_pool()
    app.state.redis = await create_pool(_get_redis_settings())
    yield
    # Shutdown: Disconnect database pool and Redis Queue
    await prisma.disconnect()
    await close_db_pool()
    try:
        if hasattr(app.state.redis, "aclose"):
            await app.state.redis.aclose()
        elif hasattr(app.state.redis, "close"):
            res = app.state.redis.close()
            if asyncio.iscoroutine(res):
                await res
    except Exception:
        pass

from app.core.logging import setup_logging, logger
from app.middleware.correlation import CorrelationIdMiddleware

# Initialize system-wide structured JSON logging to stdout
setup_logging()

app = FastAPI(title="Recruitment Agent API", lifespan=lifespan)

# Add Correlation ID middleware for distributed request tracing
app.add_middleware(CorrelationIdMiddleware)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", tags=["System"])
@app.get("/api/health", tags=["System"])
async def health_check():
    """Health check probe endpoint for container orchestration and uptime monitoring."""
    return {"status": "ok", "service": "recruitment-agent-backend"}

class CampaignCreate(BaseModel):
    id: Optional[str] = None
    title: str
    jobDescription: str
    resumes: List[str]
    hardFiltersConfig: Optional[List[dict]] = None
    enableInterviews: bool = True
    interviewConfig: Optional[str] = None
    strictness: str = "moderate"

@app.get("/api/upload/presigned-url")
async def get_presigned_upload_url(
    filename: str, 
    contentType: Optional[str] = "application/pdf", 
    campaignId: Optional[str] = None,
    user: dict = Depends(verify_jwt)
):
    """
    Generate a presigned PUT URL for direct browser upload to Cloudflare R2.
    Optionally isolates under campaigns/{campaignId}/ folder.
    """
    try:
        from app.services.r2_service import generate_presigned_upload_url
        res = generate_presigned_upload_url(filename, contentType or "application/pdf", campaign_id=campaignId)
        return res
    except ValueError as ve:
        logger.error(f"R2 configuration error: {ve}")
        raise HTTPException(status_code=500, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to generate presigned upload URL: {e}")
        raise HTTPException(status_code=500, detail="Could not generate upload URL")

@app.post("/api/campaigns")
async def create_campaign(campaign: CampaignCreate, request: Request, background_tasks: BackgroundTasks, user: dict = Depends(verify_jwt)):
    from prisma import Json
    from app.agent.security import validate_untrusted_input

    # Gatekeeper validation for untrusted recruiter inputs before saving to DB or invoking LLMs
    clean_jd = validate_untrusted_input(
        campaign.jobDescription,
        field_name="Job Description",
        min_chars=50,
        max_chars=25000
    )
    clean_interview_config = None
    if campaign.interviewConfig:
        clean_interview_config = validate_untrusted_input(
            campaign.interviewConfig,
            field_name="Interview Config",
            min_chars=0,
            max_chars=2000,
            allow_empty=True
        ) or None

    campaign_data = {
        "userId": user.get("sub"),
        "title": campaign.title,
        "jobDescription": clean_jd,
        "hardFiltersConfig": Json(campaign.hardFiltersConfig) if campaign.hardFiltersConfig is not None else None,
        "enableInterviews": campaign.enableInterviews,
        "interviewConfig": clean_interview_config,
        "evaluationStrictness": campaign.strictness
    }
    if campaign.id and campaign.id.strip():
        campaign_data["id"] = campaign.id.strip()

    new_campaign = await prisma.campaign.create(data=campaign_data)
    
    # Synchronously generate canonical JD spec, distilled JD, and embedding before queuing any candidates
    jd_extraction_cost = 0.0
    jd_extraction_tokens = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
    jd_embedding_cost = 0.0
    jd_embedding_tokens = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}

    try:
        from app.agent.nodes.jd_matcher import distill_jd_requirements_with_cost
        canonical_spec, spec_cost, spec_tokens = await distill_jd_requirements_with_cost(clean_jd)
        spec_dict = canonical_spec.model_dump() if hasattr(canonical_spec, "model_dump") else canonical_spec.dict()
        
        jd_extraction_cost += spec_cost
        jd_extraction_tokens["input_tokens"] += spec_tokens.get("input_tokens", 0)
        jd_extraction_tokens["output_tokens"] += spec_tokens.get("output_tokens", 0)
        jd_extraction_tokens["total_tokens"] += spec_tokens.get("total_tokens", 0)

        await prisma.campaign.update(
            where={"id": new_campaign.id},
            data={"canonicalJdSpec": Json(spec_dict)}
        )
        logger.info(f"[CanonicalJDSpec] Distilled and stored canonical spec for Campaign '{new_campaign.title}' ({new_campaign.id})")
    except Exception as e:
        logger.warning(f"Failed to generate canonical JD spec during campaign creation: {e}")

    try:
        from app.agent.embeddings import _distill_jd_with_cost_async, get_embedding_with_cost_async
        distilled_jd, distill_cost, distill_tokens = await _distill_jd_with_cost_async(clean_jd)
        jd_embedding, embed_cost, embed_tokens = await get_embedding_with_cost_async(distilled_jd)
        
        jd_extraction_cost += distill_cost
        jd_extraction_tokens["input_tokens"] += distill_tokens.get("input_tokens", 0)
        jd_extraction_tokens["output_tokens"] += distill_tokens.get("output_tokens", 0)
        jd_extraction_tokens["total_tokens"] += distill_tokens.get("total_tokens", 0)

        jd_embedding_cost += embed_cost
        jd_embedding_tokens["input_tokens"] += embed_tokens.get("input_tokens", 0)
        jd_embedding_tokens["output_tokens"] += embed_tokens.get("output_tokens", 0)
        jd_embedding_tokens["total_tokens"] += embed_tokens.get("total_tokens", 0)

        await prisma.execute_raw('''
            UPDATE "Campaign"
            SET "distilledJd" = $1, "jdEmbedding" = $2::vector
            WHERE id = $3
        ''', distilled_jd, str(jd_embedding), new_campaign.id)

        campaign_cost_breakdown = {}
        if jd_extraction_cost > 0 or jd_extraction_tokens["total_tokens"] > 0:
            campaign_cost_breakdown["jd_extraction"] = {
                "cost": round(jd_extraction_cost, 6),
                "tokens": jd_extraction_tokens,
                "model": "google/gemini-3.1-flash-lite"
            }
        if jd_embedding_cost > 0 or jd_embedding_tokens["total_tokens"] > 0:
            campaign_cost_breakdown["jd_embedding"] = {
                "cost": round(jd_embedding_cost, 6),
                "tokens": jd_embedding_tokens,
                "model": "text-embedding-3-small"
            }

        total_setup_cost = round(jd_extraction_cost + jd_embedding_cost, 6)
        if total_setup_cost > 0 or campaign_cost_breakdown:
            await prisma.campaign.update(
                where={"id": new_campaign.id},
                data={
                    "apiCost": total_setup_cost,
                    "costBreakdown": Json(campaign_cost_breakdown)
                }
            )

        from app.dev_logger import log_event
        log_event(new_campaign.id, "JD_EMBEDDING", f"JD embedded successfully for Campaign '{new_campaign.title}' ({new_campaign.id})")
        logger.info(f"[JD Embedding] Distilled and embedded JD for Campaign '{new_campaign.title}' ({new_campaign.id})")
    except Exception as e:
        logger.warning(f"Failed to generate JD embedding during campaign creation: {e}")
        # The embedding_matcher_node will self-heal and generate it when the first candidate runs
    
    import uuid
    candidate_records = []
    jobs_to_enqueue = []
    
    import re
    from urllib.parse import unquote
    
    for resume_url in campaign.resumes:
        if not resume_url or not isinstance(resume_url, str) or not resume_url.strip():
            continue
        filename = resume_url.split("/")[-1].split("?")[0]
        clean_filename = unquote(filename)
        base_name = clean_filename.rsplit(".", 1)[0] if "." in clean_filename else clean_filename
        
        # Strip UUID prefix if present (e.g. 12345678-1234-1234-1234-123456789abc_John_Doe -> John_Doe)
        uuid_pattern = r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}[_-]?'
        stripped_name = re.sub(uuid_pattern, '', base_name).strip()
        
        is_pure_uuid = bool(re.match(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$', stripped_name)) or bool(re.match(r'^[0-9a-fA-F]{32}$', stripped_name))
        
        if stripped_name and not is_pure_uuid and stripped_name.lower() != "unknown candidate":
            init_name = re.sub(r'[_-]+', ' ', stripped_name).title()
        else:
            init_name = "Processing Candidate..."

        cand_id = str(uuid.uuid4())
        
        candidate_records.append({
            "id": cand_id,
            "campaignId": new_campaign.id,
            "name": init_name,
            "status": "pending",
            "cvUrl": resume_url
        })
        jobs_to_enqueue.append((cand_id, resume_url, clean_jd))
        
    if candidate_records:
        await prisma.candidate.create_many(data=candidate_records)
        for cand_id, resume_url, job_desc in jobs_to_enqueue:
            await request.app.state.redis.enqueue_job(
                'process_cv_task',
                cand_id,
                resume_url,
                job_desc
            )
        
    return {"status": "success", "campaignId": new_campaign.id}

@app.post("/api/campaigns/{id}/retry-failed")
async def retry_failed_candidates(id: str, request: Request, user: dict = Depends(verify_jwt)):
    campaign = await prisma.campaign.find_first(where={"id": id, "userId": user.get("sub")})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    # Find all candidates that are pending or rejected but have a cvUrl
    failed_candidates = await prisma.candidate.find_many(
        where={
            "campaignId": id,
            "status": {"in": ["pending", "screening", "rejected"]},
            "cvUrl": {"not": None}
        }
    )
    
    retried_count = 0
    for cand in failed_candidates:
        if cand.status == "rejected" and cand.rejectionReason != "System Error: Pipeline failed":
            # Don't retry candidates rejected for actual reasons like low score
            continue
            
        await request.app.state.redis.enqueue_job(
            'process_cv_task',
            cand.id,
            cand.cvUrl,
            campaign.jobDescription
        )
        retried_count += 1
        
    return {"status": "success", "message": f"Queued {retried_count} candidates for retry", "count": retried_count}

class CampaignInterviewConfigUpdate(BaseModel):
    interviewConfig: Optional[str] = None

@app.patch("/api/campaigns/{id}/interview-config")
async def update_campaign_interview_config(id: str, config_data: CampaignInterviewConfigUpdate, user: dict = Depends(verify_jwt)):
    from app.agent.security import validate_untrusted_input
    campaign = await prisma.campaign.find_first(where={"id": id, "userId": user.get("sub")})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    clean_interview_config = None
    if config_data.interviewConfig:
        clean_interview_config = validate_untrusted_input(
            config_data.interviewConfig,
            field_name="Interview Config",
            min_chars=0,
            max_chars=2000,
            allow_empty=True
        ) or None

    updated = await prisma.campaign.update(
        where={"id": id},
        data={"interviewConfig": clean_interview_config}
    )
    return {"status": "success", "campaignId": updated.id, "interviewConfig": updated.interviewConfig}


@app.get("/")
async def root():
    return {"status": "ok", "message": "Recruitment Agent API is running"}

@app.get("/api/health/db")
async def health_db():
    try:
        # Simple query to check if DB is awake
        await prisma.query_raw("SELECT 1")
        return {"status": "ok", "message": "Database is awake and reachable"}
    except Exception as e:
        # If it throws P1001 or timeout, it means it's likely waking up or unreachable
        raise HTTPException(status_code=503, detail="Database is waking up or unreachable")

def _format_candidate_dict(cand_dict: dict) -> dict:
    if cand_dict.get("resume"):
        cand_dict["structuredProfile"] = cand_dict["resume"].get("structuredProfile")
        cand_dict["rawCvText"] = cand_dict["resume"].get("rawCvText")
    else:
        cand_dict["structuredProfile"] = None
        cand_dict["rawCvText"] = None

    if cand_dict.get("totalExperienceYears") is None and cand_dict.get("structuredProfile"):
        sp = cand_dict["structuredProfile"]
        if isinstance(sp, str):
            try:
                import json
                sp = json.loads(sp)
            except Exception:
                sp = {}
        if isinstance(sp, dict):
            cand_dict["totalExperienceYears"] = sp.get("total_experience_years") or sp.get("totalExperienceYears")

    if not cand_dict.get("currentRole") and cand_dict.get("structuredProfile"):
        sp = cand_dict["structuredProfile"]
        if isinstance(sp, str):
            try:
                import json
                sp = json.loads(sp)
            except Exception:
                sp = {}
        if isinstance(sp, dict):
            cand_dict["currentRole"] = sp.get("current_role") or sp.get("currentRole") or "Candidate"

    if cand_dict.get("evaluation"):
        eval_obj = cand_dict["evaluation"]
        if isinstance(eval_obj, dict):
            import json
            for json_field in ["interviewQuestions", "interviewTranscript", "antiCheatFlags", "antiCheatMetadata", "scoreBreakdown"]:
                val = eval_obj.get(json_field)
                if isinstance(val, str):
                    try:
                        eval_obj[json_field] = json.loads(val)
                    except Exception:
                        pass

            if eval_obj.get("aiGeneratedLikelihoodScore") is None:
                eval_obj["aiGeneratedLikelihoodScore"] = 0.0
            if eval_obj.get("antiCheatFlags") is None:
                eval_obj["antiCheatFlags"] = []
            if eval_obj.get("antiCheatMetadata") is None:
                eval_obj["antiCheatMetadata"] = {}

            eval_obj["ai_generated_likelihood_score"] = eval_obj["aiGeneratedLikelihoodScore"]
            eval_obj["anti_cheat_flags"] = eval_obj["antiCheatFlags"]
            eval_obj["anti_cheat_metadata"] = eval_obj["antiCheatMetadata"]

            iq = eval_obj.get("interviewQuestions") or []
            transcript = eval_obj.get("interviewTranscript") or []

            if isinstance(iq, list) and len(iq) > 0:
                cand_turns = [t for t in transcript if isinstance(t, dict) and t.get("role") == "candidate"]
                answered_count = len(cand_turns)
                cand_dict["answeredCount"] = answered_count

                if answered_count < len(iq):
                    q_item = iq[answered_count]
                    cand_dict["currentQuestion"] = q_item.get("question") if isinstance(q_item, dict) else str(q_item)
                else:
                    q_item = iq[-1]
                    cand_dict["currentQuestion"] = q_item.get("question") if isinstance(q_item, dict) else str(q_item)

    if cand_dict.get("costBreakdown"):
        if isinstance(cand_dict["costBreakdown"], str):
            import json
            try:
                cand_dict["costBreakdown"] = json.loads(cand_dict["costBreakdown"])
            except Exception:
                pass
    cand_dict["cost_breakdown"] = cand_dict.get("costBreakdown")
    cand_dict["api_cost"] = cand_dict.get("apiCost", 0.0)

    return cand_dict


def _format_campaign_dict(c_dict: dict) -> dict:
    import json
    setup_cost = c_dict.get("apiCost", 0.0) or 0.0
    total_cost = float(setup_cost)

    for cand in c_dict.get("candidates", []):
        total_cost += float(cand.get("apiCost", 0.0) or 0.0)
        _format_candidate_dict(cand)

    c_dict["totalCost"] = round(total_cost, 6)

    cb = c_dict.get("costBreakdown")
    if isinstance(cb, str):
        try:
            cb = json.loads(cb)
        except Exception:
            cb = None
    c_dict["costBreakdown"] = cb
    c_dict["cost_breakdown"] = cb
    c_dict["api_cost"] = setup_cost
    return c_dict


@app.get("/api/campaigns")
async def get_campaigns(user: dict = Depends(verify_jwt)):
    """Get all job campaigns."""
    campaigns = await prisma.campaign.find_many(
        where={
            "userId": user.get("sub")
        },
        include={
            "candidates": {
                "include": {
                    "evaluation": True,
                    "resume": True
                }
            }
        }
    )
    
    result = []
    for c in campaigns:
        c_dict = c.model_dump() if hasattr(c, "model_dump") else c.dict()
        _format_campaign_dict(c_dict)
        result.append(c_dict)
    return result


@app.get("/api/campaigns/{id}")
async def get_campaign(id: str, user: dict = Depends(verify_jwt)):
    campaign = await prisma.campaign.find_first(
        where={"id": id, "userId": user.get("sub")},
        include={
            "candidates": {
                "include": {
                    "evaluation": True,
                    "resume": True
                }
            }
        }
    )
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    c_dict = campaign.model_dump() if hasattr(campaign, "model_dump") else campaign.dict()
    return _format_campaign_dict(c_dict)

@app.get("/api/candidates/{id}")
async def get_candidate(id: str):
    candidate = await prisma.candidate.find_unique(
        where={"id": id},
        include={
            "campaign": True,
            "resume": True,
            "evaluation": True
        }
    )
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    cand_dict = candidate.model_dump() if hasattr(candidate, "model_dump") else candidate.dict()
    return _format_candidate_dict(cand_dict)

class SendInvitationsRequest(BaseModel):
    candidateIds: List[str]

class StartInterviewRequest(BaseModel):
    token: str
    email: str
    consent: bool
    termsVersionAgreed: Optional[str] = "v1.0"
    privacyPolicyVersionAgreed: Optional[str] = "v1.0"

@app.post("/api/interviews/send-invitations")
async def send_interview_invitations(req: SendInvitationsRequest, user: dict = Depends(verify_jwt)):
    """Bulk send interview invitation emails with protected cryptographic tokens."""
    if not req.candidateIds:
        raise HTTPException(status_code=400, detail="No candidate IDs provided")
        
    candidates = await prisma.candidate.find_many(
        where={"id": {"in": req.candidateIds}},
        include={"campaign": True}
    )
    
    email_tasks = []
    async with prisma.tx() as tx:
        for cand in candidates:
            if not cand.email:
                continue
                
            token = generate_interview_token(cand.id, cand.email)
            interview_url = f"{FRONTEND_URL}/interview/{cand.id}?token={token}"
            
            await tx.candidate.update(
                where={"id": cand.id},
                data={
                    "invitationToken": token,
                    "invitedAt": now,
                    "status": "invited"
                }
            )
            campaign_title = cand.campaign.title if cand.campaign else "AI Candidate Assessment"
            email_tasks.append((cand.name, cand.email, campaign_title, interview_url))
            sent_count += 1

    for name, email, campaign_title, interview_url in email_tasks:
        await send_interview_invitation_email(name, email, campaign_title, interview_url)
        
    return {"status": "success", "count": sent_count, "message": f"Sent {sent_count} interview invitation emails."}

@app.get("/api/candidates/{id}/interview-access")
async def check_interview_access(id: str, token: str):
    """
    Verifies that the provided token grants access to candidate's interview.
    Returns masked info without revealing questions or raw CV.
    """
    token_data = verify_interview_token(token)
    if token_data["candidate_id"] != id:
        raise HTTPException(status_code=403, detail="Token does not match target candidate")
        
    candidate = await prisma.candidate.find_unique(
        where={"id": id},
        include={"campaign": True, "evaluation": True}
    )
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    email = candidate.email or ""
    masked_email = ""
    if "@" in email:
        parts = email.split("@")
        user_part = parts[0]
        masked_user = user_part[0] + "***" + (user_part[-1] if len(user_part) > 1 else "")
        masked_email = f"{masked_user}@{parts[1]}"
    else:
        masked_email = "***"

    has_questions = bool(candidate.evaluation and candidate.evaluation.interviewQuestions)
    
    return {
        "valid": True,
        "candidateId": candidate.id,
        "candidateName": candidate.name,
        "campaignTitle": candidate.campaign.title if candidate.campaign else "Assessment",
        "maskedEmail": masked_email,
        "status": candidate.status,
        "hasQuestions": has_questions
    }

@app.post("/api/candidates/{id}/start-interview")
async def start_candidate_interview(id: str, req: StartInterviewRequest):
    """
    Validates token + matching candidate email + policy consent.
    Dynamically generates questions on-demand via LLM if not already generated,
    and advances candidate status to 'interviewing'.
    """
    if not req.consent:
        raise HTTPException(status_code=422, detail="Explicit consent to Terms of Service and Privacy Policy is required to proceed with assessment.")
        
    token_data = verify_interview_token(req.token)
    if token_data["candidate_id"] != id:
        raise HTTPException(status_code=403, detail="Token does not match target candidate")
        
    candidate = await prisma.candidate.find_unique(
        where={"id": id},
        include={"campaign": True, "evaluation": True}
    )
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    cand_email = (candidate.email or "").strip().lower()
    input_email = req.email.strip().lower()
    
    if cand_email and cand_email != input_email:
        raise HTTPException(status_code=403, detail="Specified email does not match the invitation email for this assessment.")

    now = datetime.datetime.now(datetime.timezone.utc)
    await prisma.candidate.update(
        where={"id": id},
        data={
            "consentGivenAt": now,
            "termsVersionAgreed": req.termsVersionAgreed or "v1.0",
            "privacyPolicyVersionAgreed": req.privacyPolicyVersionAgreed or "v1.0"
        }
    )

    await generate_on_demand_questions(id)
    
    updated_cand = await get_candidate(id)
    return updated_cand

class InterviewAnswerRequest(BaseModel):
    answer: str
    anti_cheat_telemetry: Optional[dict] = None
    telemetry: Optional[dict] = None
    expected_turn_index: Optional[int] = None

# Aliases for backward compatibility in tests
InterviewAnswer = InterviewAnswerRequest

@app.post("/api/candidates/{id}/interview/answer")
async def submit_candidate_interview_answer(id: str, req: InterviewAnswerRequest):
    """
    Submits a candidate's answer for their active interview session.
    Validates input length, neutralizes prompt injection payloads,
    updates transcript with telemetry, and enqueues evaluation when complete.
    """
    if len(req.answer) > 10000:
        raise HTTPException(status_code=400, detail="Answer exceeds maximum permissible character limit.")

    candidate = await prisma.candidate.find_unique(where={"id": id})
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    if candidate.status not in ["interviewing", "invited", "shortlisted"]:
        raise HTTPException(status_code=400, detail=f"Candidate is not in an active interview status (current: {candidate.status})")

    await process_interview_answer(
        candidate_id=id,
        answer_text=req.answer,
        telemetry=req.anti_cheat_telemetry,
        expected_turn_index=req.expected_turn_index
    )

    updated_cand = await get_candidate(id)
    return updated_cand

submit_interview_answer = submit_candidate_interview_answer

@app.get("/api/interviews/candidates")
async def get_interview_candidates(campaignId: Optional[str] = None, status: Optional[str] = None, user: dict = Depends(verify_jwt)):
    """Fetch candidates across campaigns specifically for the Interviews management tab."""
    where_filter: dict = {}
    if campaignId:
        where_filter["campaignId"] = campaignId
    if status:
        where_filter["status"] = status
    else:
        where_filter["status"] = {"in": ["shortlisted", "invited", "interviewing", "interview_completed", "review", "complete", "finalized"]}
        
    candidates = await prisma.candidate.find_many(
        where=where_filter,
        include={"campaign": True, "evaluation": True},
        order={"updatedAt": "desc"}
    )
    
    result = []
    for cand in candidates:
        c_dict = cand.model_dump() if hasattr(cand, "model_dump") else cand.dict()
        _format_candidate_dict(c_dict)
        c_dict["campaignTitle"] = cand.campaign.title if cand.campaign else "Unknown Campaign"
        c_dict["hasQuestions"] = bool(cand.evaluation and cand.evaluation.interviewQuestions)
        result.append(c_dict)
        
    return result

# ── FAQ QUESTION & KNOWLEDGE DISCOVERY ENDPOINTS ─────────────────────────────

class FaqQuestionCreate(BaseModel):
    category: str
    question: str
    contextDetails: Optional[str] = None
    company: Optional[str] = None
    role: Optional[str] = None
    candidateVolume: Optional[str] = None
    urgency: Optional[str] = "medium"
    name: str
    email: str
    preferredContact: Optional[str] = "email"

class FaqSearchQuery(BaseModel):
    query: str
    category: Optional[str] = None

# Pre-populated Knowledge Base Items for instant research during question drafting
FAQ_KNOWLEDGE_BASE = [
    {
        "id": "kb-1",
        "category": "Screening Engine",
        "title": "Multi-Criteria Resume & Profile Evaluation Engine",
        "snippet": "hireagent utilizes LLM embeddings and deterministic hard filters to evaluate candidates against custom job descriptions with configurable strictness levels (lenient, moderate, strict).",
        "tags": ["Screening", "Algorithms", "Scoring", "Strictness"]
    },
    {
        "id": "kb-2",
        "category": "Interview Workflows",
        "title": "Dynamic Voice & Text Conversational Assessments",
        "snippet": "Candidates receive securely tokenized invitations to complete interactive video/audio or text assessments. Questions adapt in real-time based on candidate responses.",
        "tags": ["Interviews", "Adaptive Questions", "Candidate Experience"]
    },
    {
        "id": "kb-3",
        "category": "Data Privacy & Security",
        "title": "SOC2 & GDPR Enterprise Privacy Standards",
        "snippet": "All candidate data and resume embeddings are encrypted at rest and in transit. Supabase Row-Level Security (RLS) guarantees complete tenant isolation.",
        "tags": ["Security", "GDPR", "Encryption", "RLS"]
    },
    {
        "id": "kb-4",
        "category": "System Integration & API",
        "title": "ATS Synchronization & Custom Webhook Hooks",
        "snippet": "Integrate seamlessly with Greenhouse, Lever, Workday, and custom backend systems via REST API endpoints and webhooks for status callbacks.",
        "tags": ["API", "ATS", "Webhooks", "Integration"]
    },
    {
        "id": "kb-5",
        "category": "Enterprise Onboarding",
        "title": "High-Volume Pipeline Automation & SLA",
        "snippet": "Built for scale, hireagent processes thousands of applicants concurrently with distributed queue workers and dedicated priority infrastructure.",
        "tags": ["Enterprise", "High-Volume", "SLA", "Workers"]
    }
]

@app.post("/api/faqs/questions")
async def create_faq_question(data: FaqQuestionCreate):
    """Store a user's submitted question from the multi-step FAQ wizard in PostgreSQL."""
    if not data.question or not data.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    if not data.email or "@" not in data.email:
        raise HTTPException(status_code=400, detail="Valid email address is required")
    if not data.name or not data.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")

    question_record = await prisma.faqquestion.create(
        data={
            "category": data.category or "General",
            "question": data.question.strip(),
            "contextDetails": data.contextDetails.strip() if data.contextDetails else None,
            "company": data.company.strip() if data.company else None,
            "role": data.role.strip() if data.role else None,
            "candidateVolume": data.candidateVolume or "1-50 candidates/mo",
            "urgency": data.urgency or "medium",
            "name": data.name.strip(),
            "email": data.email.strip().lower(),
            "preferredContact": data.preferredContact or "email",
            "status": "pending",
        }
    )
    return question_record

@app.get("/api/faqs/questions")
async def list_faq_questions(status: Optional[str] = None, category: Optional[str] = None):
    """Retrieve submitted FAQ questions from PostgreSQL."""
    where_filter: dict = {}
    if status:
        where_filter["status"] = status
    if category:
        where_filter["category"] = category

    questions = await prisma.faqquestion.find_many(
        where=where_filter,
        order={"createdAt": "desc"}
    )
    return questions

@app.post("/api/faqs/search-knowledge")
async def search_faq_knowledge(body: FaqSearchQuery):
    """Search existing FAQs and knowledge topics for live research in the wizard."""
    query = (body.query or "").strip().lower()
    cat_filter = (body.category or "").strip().lower()

    matches = []
    for item in FAQ_KNOWLEDGE_BASE:
        # Category filter check
        if cat_filter and cat_filter not in item["category"].lower():
            continue

        # Search match check
        if not query:
            matches.append(item)
        else:
            in_title = query in item["title"].lower()
            in_snippet = query in item["snippet"].lower()
            in_tags = any(query in tag.lower() for tag in item["tags"])
            if in_title or in_snippet or in_tags:
                matches.append(item)

    return {"results": matches, "count": len(matches)}

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)



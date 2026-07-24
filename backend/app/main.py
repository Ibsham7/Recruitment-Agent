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
from app.agent.api import start_candidate_pipeline, resume_pipeline, generate_on_demand_questions
from app.database import prisma
from app.agent.embeddings import _distill_jd_async, get_embedding_async
from app.security import verify_jwt
from app.interview_security import generate_interview_token, verify_interview_token
from app.services.email_service import send_interview_invitation_email
import datetime
from fastapi import Depends
from arq import create_pool
from arq.connections import RedisSettings

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

async def lifespan(app: FastAPI):
    # Startup: Connect to the database and Redis Queue
    await prisma.connect()
    app.state.redis = await create_pool(RedisSettings.from_dsn(REDIS_URL))
    yield
    # Shutdown: Disconnect from the database and Redis Queue
    await prisma.disconnect()
    app.state.redis.close()
    await app.state.redis.wait_closed()

app = FastAPI(title="Recruitment Agent API", lifespan=lifespan)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CampaignCreate(BaseModel):
    title: str
    jobDescription: str
    resumes: List[str]
    hardFiltersConfig: Optional[List[dict]] = None
    enableInterviews: bool = True
    interviewConfig: Optional[str] = None
    strictness: str = "moderate"

@app.post("/api/campaigns")
async def create_campaign(campaign: CampaignCreate, request: Request, background_tasks: BackgroundTasks, user: dict = Depends(verify_jwt)):
    from prisma import Json
    new_campaign = await prisma.campaign.create(
        data={
            "userId": user.get("sub"),
            "title": campaign.title,
            "jobDescription": campaign.jobDescription,
            "hardFiltersConfig": Json(campaign.hardFiltersConfig) if campaign.hardFiltersConfig is not None else None,
            "enableInterviews": campaign.enableInterviews,
            "interviewConfig": campaign.interviewConfig,
            "evaluationStrictness": campaign.strictness
        }
    )
    
    # Synchronously generate distilled JD and embedding before queuing any candidates
    try:
        distilled_jd = await _distill_jd_async(campaign.jobDescription)
        jd_embedding = await get_embedding_async(distilled_jd)
        
        await prisma.execute_raw('''
            UPDATE "Campaign"
            SET "distilledJd" = $1, "jdEmbedding" = $2::vector
            WHERE id = $3
        ''', distilled_jd, str(jd_embedding), new_campaign.id)
    except Exception as e:
        print(f"Warning: Failed to generate JD embedding during campaign creation: {e}")
        # The embedding_matcher_node will self-heal and generate it when the first candidate runs
    
    import uuid
    candidate_records = []
    jobs_to_enqueue = []
    
    for resume_url in campaign.resumes:
        filename = resume_url.split("/")[-1]
        name = filename.split(".")[0] if "." in filename else "Unknown Candidate"
        cand_id = str(uuid.uuid4())
        
        candidate_records.append({
            "id": cand_id,
            "campaignId": new_campaign.id,
            "name": name.replace("%20", " "),
            "status": "pending",
            "cvUrl": resume_url
        })
        jobs_to_enqueue.append((cand_id, resume_url, campaign.jobDescription))
        
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
        for cand in c_dict.get("candidates", []):
            if cand.get("resume"):
                cand["structuredProfile"] = cand["resume"].get("structuredProfile")
                cand["rawCvText"] = cand["resume"].get("rawCvText")
            else:
                cand["structuredProfile"] = None
                cand["rawCvText"] = None
        result.append(c_dict)
    return result

class InterviewAnswer(BaseModel):
    answer: str

@app.post("/api/candidates/{id}/interview/answer")
async def submit_interview_answer(id: str, answer_data: InterviewAnswer, request: Request):
    await request.app.state.redis.enqueue_job('resume_pipeline_task', id, answer_data.answer)
    return {"status": "success", "message": "Answer submitted"}

class HumanReview(BaseModel):
    decision: str # approve, reject, hold

@app.post("/api/candidates/{id}/review")
async def submit_human_review(id: str, review_data: HumanReview, request: Request, user: dict = Depends(verify_jwt)):
    try:
        status_update = "complete" if review_data.decision != "approve" and review_data.decision != "override" else "interviewing"
        await prisma.candidate.update(
            where={"id": id},
            data={
                "status": status_update,
                "decision": review_data.decision
            }
        )
        # Resume the paused LangGraph thread so execution advances correctly
        resume_val = "override" if review_data.decision in ["approve", "override"] else "reject"
        await request.app.state.redis.enqueue_job('resume_pipeline_task', id, resume_val)
        return {"status": "success", "message": "Review submitted and pipeline resumed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
    total_cost = 0.0
    for cand in c_dict.get("candidates", []):
        total_cost += cand.get("apiCost", 0.0)
        if cand.get("resume"):
            cand["structuredProfile"] = cand["resume"].get("structuredProfile")
            cand["rawCvText"] = cand["resume"].get("rawCvText")
        else:
            cand["structuredProfile"] = None
            cand["rawCvText"] = None
    
    # COST_TRACKING: Remove after testing
    c_dict["totalCost"] = total_cost
    return c_dict

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
    if cand_dict.get("resume"):
        cand_dict["structuredProfile"] = cand_dict["resume"].get("structuredProfile")
        cand_dict["rawCvText"] = cand_dict["resume"].get("rawCvText")
    else:
        cand_dict["structuredProfile"] = None
        cand_dict["rawCvText"] = None

    # Dynamically resolve currentQuestion for interview workflow
    if cand_dict.get("evaluation") and cand_dict["evaluation"].get("interviewQuestions"):
        iq = cand_dict["evaluation"]["interviewQuestions"]
        if isinstance(iq, list) and len(iq) > 0:
            transcript = cand_dict["evaluation"].get("interviewTranscript") or []
            ai_turns = [t for t in transcript if isinstance(t, dict) and t.get("role") in ["ai", "interviewer"]]
            curr_idx = len(ai_turns)
            if curr_idx < len(iq):
                q_item = iq[curr_idx]
                cand_dict["currentQuestion"] = q_item.get("question") if isinstance(q_item, dict) else str(q_item)
            else:
                q_item = iq[-1]
                cand_dict["currentQuestion"] = q_item.get("question") if isinstance(q_item, dict) else str(q_item)

    # Composite score computation (40% screening fitScore + 60% interview overallScore)
    fit_score = cand_dict.get("fitScore")
    if fit_score is not None and cand_dict.get("evaluation") and cand_dict["evaluation"].get("overallScore") is not None:
        interview_score = cand_dict["evaluation"]["overallScore"]
        cand_dict["compositeScore"] = round((fit_score * 0.4) + (interview_score * 0.6), 1)
    else:
        cand_dict["compositeScore"] = fit_score

    return cand_dict

class SendInvitationsRequest(BaseModel):
    candidateIds: List[str]

class StartInterviewRequest(BaseModel):
    token: str
    email: str
    consent: bool

@app.post("/api/interviews/send-invitations")
async def send_interview_invitations(req: SendInvitationsRequest, user: dict = Depends(verify_jwt)):
    """Bulk send interview invitation emails with protected cryptographic tokens."""
    if not req.candidateIds:
        raise HTTPException(status_code=400, detail="No candidate IDs provided")
        
    candidates = await prisma.candidate.find_many(
        where={"id": {"in": req.candidateIds}},
        include={"campaign": True}
    )
    
    sent_count = 0
    now = datetime.datetime.now(datetime.timezone.utc)
    
    for cand in candidates:
        if not cand.email:
            continue
            
        token = generate_interview_token(cand.id, cand.email)
        interview_url = f"{FRONTEND_URL}/interview/{cand.id}?token={token}"
        
        await prisma.candidate.update(
            where={"id": cand.id},
            data={
                "invitationToken": token,
                "invitedAt": now,
                "status": "invited"
            }
        )
        
        campaign_title = cand.campaign.title if cand.campaign else "AI Candidate Assessment"
        await send_interview_invitation_email(cand.name, cand.email, campaign_title, interview_url)
        sent_count += 1
        
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
        raise HTTPException(status_code=400, detail="Consent is required to start assessment")
        
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
        
    await generate_on_demand_questions(id)
    
    updated_cand = await get_candidate(id)
    return updated_cand

@app.get("/api/interviews/candidates")
async def get_interview_candidates(campaignId: Optional[str] = None, status: Optional[str] = None, user: dict = Depends(verify_jwt)):
    """Fetch candidates across campaigns specifically for the Interviews management tab."""
    where_filter: dict = {}
    if campaignId:
        where_filter["campaignId"] = campaignId
    if status:
        where_filter["status"] = status
    else:
        where_filter["status"] = {"in": ["shortlisted", "invited", "interviewing", "review", "complete", "finalized"]}
        
    candidates = await prisma.candidate.find_many(
        where=where_filter,
        include={"campaign": True, "evaluation": True},
        order={"updatedAt": "desc"}
    )
    
    result = []
    for cand in candidates:
        c_dict = cand.model_dump() if hasattr(cand, "model_dump") else cand.dict()
        c_dict["campaignTitle"] = cand.campaign.title if cand.campaign else "Unknown Campaign"
        c_dict["hasQuestions"] = bool(cand.evaluation and cand.evaluation.interviewQuestions)
        result.append(c_dict)
        
    return result

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)


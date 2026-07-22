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
from app.agent.api import start_candidate_pipeline, resume_pipeline
from app.database import prisma
from app.agent.embeddings import _distill_jd_async, get_embedding_async
from app.security import verify_jwt
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
    
    for resume_url in campaign.resumes:
        # Extract a basic name from the URL string
        filename = resume_url.split("/")[-1]
        name = filename.split(".")[0] if "." in filename else "Unknown Candidate"
        
        candidate = await prisma.candidate.create(
            data={
                "campaign": {"connect": {"id": new_campaign.id}},
                "name": name.replace("%20", " "),
                "status": "pending",
                "cvUrl": resume_url
            }
        )
        
        await request.app.state.redis.enqueue_job(
            'process_cv_task',
            candidate.id,
            resume_url,
            campaign.jobDescription
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
    return cand_dict

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

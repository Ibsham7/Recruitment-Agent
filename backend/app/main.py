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

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the exact frontend URL (e.g., http://localhost:5173)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CampaignCreate(BaseModel):
    title: str
    jobDescription: str
    resumes: List[str]
    hardFiltersConfig: Optional[List[dict]] = None

@app.post("/api/campaigns")
async def create_campaign(campaign: CampaignCreate, request: Request, background_tasks: BackgroundTasks):
    from prisma import Json
    new_campaign = await prisma.campaign.create(
        data={
            "title": campaign.title,
            "jobDescription": campaign.jobDescription,
            "hardFiltersConfig": Json(campaign.hardFiltersConfig) if campaign.hardFiltersConfig is not None else None
        }
    )
    
    for resume_url in campaign.resumes:
        # Extract a basic name from the URL string
        filename = resume_url.split("/")[-1]
        name = filename.split(".")[0] if "." in filename else "Unknown Candidate"
        
        candidate = await prisma.candidate.create(
            data={
                "campaign": {"connect": {"id": new_campaign.id}},
                "name": name.replace("%20", " "),
                "status": "pending"
            }
        )
        
        await request.app.state.redis.enqueue_job(
            'process_cv_task',
            candidate.id,
            resume_url,
            campaign.jobDescription
        )
        
    return {"status": "success", "campaignId": new_campaign.id}

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
async def get_campaigns():
    """Get all job campaigns."""
    campaigns = await prisma.campaign.find_many(
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
async def submit_human_review(id: str, review_data: HumanReview):
    try:
        await prisma.candidate.update(
            where={"id": id},
            data={
                "status": "complete",
                "decision": review_data.decision
            }
        )
        return {"status": "success", "message": "Review submitted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/campaigns/{id}")
async def get_campaign(id: str):
    campaign = await prisma.campaign.find_unique(
        where={"id": id},
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
    for cand in c_dict.get("candidates", []):
        if cand.get("resume"):
            cand["structuredProfile"] = cand["resume"].get("structuredProfile")
            cand["rawCvText"] = cand["resume"].get("rawCvText")
        else:
            cand["structuredProfile"] = None
            cand["rawCvText"] = None
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

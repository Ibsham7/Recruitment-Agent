from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
import asyncio
from app.agent.api import start_candidate_pipeline, resume_pipeline
from app.database import prisma
async def lifespan(app: FastAPI):
    # Startup: Connect to the database
    await prisma.connect()
    yield
    # Shutdown: Disconnect from the database
    await prisma.disconnect()

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
async def create_campaign(campaign: CampaignCreate, background_tasks: BackgroundTasks):
    import json
    new_campaign = await prisma.campaign.create(
        data={
            "title": campaign.title,
            "jobDescription": campaign.jobDescription,
            "hardFiltersConfig": json.dumps(campaign.hardFiltersConfig) if campaign.hardFiltersConfig else None
        }
    )
    
    for resume_url in campaign.resumes:
        # Extract a basic name from the URL string
        filename = resume_url.split("/")[-1]
        name = filename.split(".")[0] if "." in filename else "Unknown Candidate"
        
        candidate = await prisma.candidate.create(
            data={
                "campaignId": new_campaign.id,
                "name": name.replace("%20", " "),
                "resumePath": resume_url,
                "status": "pending"
            }
        )
        
        background_tasks.add_task(
            start_candidate_pipeline,
            candidate_id=candidate.id,
            cv_url=resume_url,
            jd_text=campaign.jobDescription
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
                    "evaluation": True
                }
            }
        }
    )
    return campaigns

class InterviewAnswer(BaseModel):
    answer: str

@app.post("/api/candidates/{id}/interview/answer")
async def submit_interview_answer(id: str, answer_data: InterviewAnswer, background_tasks: BackgroundTasks):
    background_tasks.add_task(resume_pipeline, candidate_id=id, resume_data=answer_data.answer)
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

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

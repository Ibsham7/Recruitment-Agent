from fastapi import FastAPI, HTTPException
from prisma import Prisma
from contextlib import asynccontextmanager
import uvicorn

# Initialize Prisma client
prisma = Prisma()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Connect to the database
    await prisma.connect()
    yield
    # Shutdown: Disconnect from the database
    await prisma.disconnect()

app = FastAPI(title="Recruitment Agent API", lifespan=lifespan)

@app.get("/")
async def root():
    return {"status": "ok", "message": "Recruitment Agent API is running"}

@app.get("/api/campaigns")
async def get_campaigns():
    """Get all job campaigns."""
    campaigns = await prisma.campaign.find_many(
        include={"candidates": True}
    )
    return campaigns

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

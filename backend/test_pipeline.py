import asyncio
from app.database import prisma
from app.agent.api import start_candidate_pipeline

async def main():
    await prisma.connect()
    
    cands = await prisma.candidate.find_many(take=1, order={'createdAt': 'desc'})
    
    if not cands:
        print("No candidates")
        await prisma.disconnect()
        return

    c = cands[0]
    print(f"Triggering pipeline for {c.id} - {c.resumePath}")
    
    camp = await prisma.campaign.find_unique(where={'id': c.campaignId})
    jd = camp.jobDescription if camp else "Software Engineer"
    
    try:
        await start_candidate_pipeline(c.id, c.resumePath, jd)
        print("Pipeline execution finished successfully.")
    except Exception as e:
        print(f"Pipeline failed: {e}")
        
    await prisma.disconnect()

import sys

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

asyncio.run(main())

import asyncio
from prisma import Prisma

async def main():
    db = Prisma()
    await db.connect()
    try:
        await db.execute_raw('ALTER TABLE "Campaign" ADD COLUMN "enableInterviews" BOOLEAN NOT NULL DEFAULT true;')
    except Exception as e:
        print("Column enableInterviews might already exist:", e)
    
    try:
        await db.execute_raw('ALTER TABLE "Campaign" ADD COLUMN "interviewConfig" TEXT;')
    except Exception as e:
        print("Column interviewConfig might already exist:", e)
        
    await db.disconnect()

asyncio.run(main())

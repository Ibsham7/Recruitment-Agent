import asyncio
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from prisma import Prisma

async def main():
    db = Prisma()
    await db.connect()
    print("Connected to DB successfully.")
    
    queries = [
        'ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "totalExperienceYears" DOUBLE PRECISION;',
        'ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "currentRole" TEXT;',
        'ALTER TABLE "Evaluation" ALTER COLUMN "technicalScore" DROP NOT NULL;',
        'ALTER TABLE "Evaluation" ALTER COLUMN "communicationScore" DROP NOT NULL;',
        'ALTER TABLE "Evaluation" ALTER COLUMN "culturalFitScore" DROP NOT NULL;',
    ]
    
    for q in queries:
        try:
            await db.execute_raw(q)
            print(f"Executed: {q}")
        except Exception as e:
            print(f"Error executing {q}: {e}")
            
    await db.disconnect()
    print("Disconnected from DB.")

if __name__ == "__main__":
    asyncio.run(main())


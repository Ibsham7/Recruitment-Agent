import asyncio
from prisma import Prisma

async def main():
    db = Prisma()
    await db.connect()
    
    try:
        await db.execute_raw('ALTER TABLE "Campaign" ADD COLUMN "evaluationStrictness" TEXT NOT NULL DEFAULT \'moderate\';')
        print("Added evaluationStrictness")
    except Exception as e:
        print("Column evaluationStrictness might already exist:", e)
    
    try:
        await db.execute_raw('ALTER TABLE "Evaluation" ADD COLUMN "chainOfThought" TEXT;')
        print("Added chainOfThought")
    except Exception as e:
        print("Column chainOfThought might already exist:", e)
        
    await db.disconnect()

if __name__ == '__main__':
    asyncio.run(main())

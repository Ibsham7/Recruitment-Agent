import asyncio
from prisma import Prisma

async def main():
    db = Prisma()
    await db.connect()
    print("Adding distilledJd and jdEmbedding columns to Campaign table...")
    try:
        await db.execute_raw('ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "distilledJd" TEXT;')
        await db.execute_raw('ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "jdEmbedding" vector(1536);')
        print("Successfully added columns.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await db.disconnect()

if __name__ == "__main__":
    asyncio.run(main())

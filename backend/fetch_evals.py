import asyncio
from app.database import prisma

async def main():
    await prisma.connect()
    evals = await prisma.evaluation.find_many(
        order={"createdAt": "desc"},
        take=3
    )
    for e in evals:
        print(f"--- Eval for {e.candidateId} ---")
        print(e.model_dump())
    await prisma.disconnect()

if __name__ == "__main__":
    asyncio.run(main())

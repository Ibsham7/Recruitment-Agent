import asyncio
from app.database import prisma
import os

async def main():
    await prisma.connect()
    
    candidates = await prisma.candidate.find_many(
        where={
            "id": {"in": [
                "f2c85132-c430-4228-a982-870efbe973b8",
                "ea1ff476-ddcb-4edd-84c8-5df0a83d5357",
                "7cb53cb6-4d63-439f-901f-3926ed952905",
                "9535a5a0-dfa9-469e-a816-18e5bd12e39a"
            ]}
        }
    )
    
    for cand in candidates:
        print(f"Candidate {cand.id} status: {cand.status}")

    await prisma.disconnect()

asyncio.run(main())

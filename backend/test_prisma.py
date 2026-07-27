import asyncio
from app.database import prisma
from prisma import Json

async def main():
    await prisma.connect()
    c = await prisma.campaign.create(data={'title': 'test', 'jobDescription': 'test', 'hardFiltersConfig': Json([{'test': 1}])})
    print(c)
    await prisma.campaign.delete(where={'id': c.id})
    await prisma.disconnect()

if __name__ == "__main__":
    asyncio.run(main())

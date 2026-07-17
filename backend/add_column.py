import asyncio
from prisma import Prisma

async def main():
    prisma = Prisma()
    await prisma.connect()
    
    try:
        await prisma.execute_raw('ALTER TABLE "Campaign" ADD COLUMN "userId" TEXT;')
        print("Column userId added successfully.")
    except Exception as e:
        print(f"Error: {e}")
        
    await prisma.disconnect()

if __name__ == '__main__':
    asyncio.run(main())

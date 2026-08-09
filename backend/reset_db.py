import asyncio
import logging
import os
from dotenv import load_dotenv

# Ensure environment variables from backend/.env are loaded regardless of current working directory
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from prisma import Prisma

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def reset_db() -> None:
    db = Prisma()
    try:
        await db.connect()
        logger.info("Connected to the database. Beginning data wipe...")
        
        # Deleting in reverse order of foreign key constraints to prevent constraint errors
        
        evaluations_deleted = await db.evaluation.delete_many()
        logger.info(f"Deleted {evaluations_deleted} evaluations.")
        
        candidates_deleted = await db.candidate.delete_many()
        logger.info(f"Deleted {candidates_deleted} candidates.")
        
        resumes_deleted = await db.resume.delete_many()
        logger.info(f"Deleted {resumes_deleted} resumes.")
        
        campaigns_deleted = await db.campaign.delete_many()
        logger.info(f"Deleted {campaigns_deleted} campaigns.")
        
        logger.info("[SUCCESS] Database reset completed successfully. All data wiped.")
        
    except Exception as e:
        logger.error(f"[ERROR] Error resetting database: {e}")
        
    finally:
        if db.is_connected():
            await db.disconnect()
            logger.info("Disconnected from the database.")

if __name__ == '__main__':
    asyncio.run(reset_db())

import asyncio
import logging
import os
import sys
from dotenv import load_dotenv

# Ensure backend root is on sys.path and load environment variables
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

load_dotenv(os.path.join(backend_dir, ".env"))

from app.database import prisma

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def reset_db() -> None:
    try:
        if not prisma.is_connected():
            await prisma.connect()
        logger.info("Connected to the database. Beginning full data wipe...")
        
        # Deleting in reverse order of foreign key constraints to prevent constraint errors
        
        evaluations_deleted = await prisma.evaluation.delete_many()
        logger.info(f"Deleted {evaluations_deleted} evaluation(s).")
        
        candidates_deleted = await prisma.candidate.delete_many()
        logger.info(f"Deleted {candidates_deleted} candidate(s).")
        
        resumes_deleted = await prisma.resume.delete_many()
        logger.info(f"Deleted {resumes_deleted} resume(s).")
        
        campaigns_deleted = await prisma.campaign.delete_many()
        logger.info(f"Deleted {campaigns_deleted} campaign(s).")
        
        analytics_deleted = await prisma.candidateanalytics.delete_many()
        logger.info(f"Deleted {analytics_deleted} candidate analytics record(s).")
        
        transactions_deleted = await prisma.credittransaction.delete_many()
        logger.info(f"Deleted {transactions_deleted} credit transaction(s).")
        
        requests_deleted = await prisma.creditrequest.delete_many()
        logger.info(f"Deleted {requests_deleted} credit request(s).")
        
        userprofiles_deleted = await prisma.userprofile.delete_many()
        logger.info(f"Deleted {userprofiles_deleted} user profile(s).")
        
        faq_deleted = await prisma.faqquestion.delete_many()
        logger.info(f"Deleted {faq_deleted} FAQ question(s).")
        
        # Truncate LangGraph checkpoint state tables if present
        try:
            await prisma.execute_raw('TRUNCATE TABLE checkpoint_writes, checkpoint_blobs, checkpoints CASCADE;')
            logger.info("Cleared LangGraph checkpoint state records.")
        except Exception as cp_err:
            logger.debug(f"LangGraph checkpoints table notice: {cp_err}")
        
        logger.info("[SUCCESS] Database reset completed successfully. All data wiped.")
        
    except Exception as e:
        logger.error(f"[ERROR] Error resetting database: {e}")
        raise e
        
    finally:
        if prisma.is_connected():
            await prisma.disconnect()
            logger.info("Disconnected from the database.")

if __name__ == '__main__':
    asyncio.run(reset_db())

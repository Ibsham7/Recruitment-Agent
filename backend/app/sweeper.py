import asyncio
import logging
from datetime import datetime, timedelta, timezone
from app.database import prisma

logger = logging.getLogger(__name__)

async def hard_delete_expired_candidates(ctx=None):
    """
    Sweeps the database for candidates older than 30 days.
    - Copies anonymous statistics to CandidateAnalytics
    - Hard deletes the Candidate (which cascades to Evaluation)
    - If the associated Resume is no longer referenced by any other candidates, deletes the Resume.
    """
    try:
        if not prisma.is_connected():
            await prisma.connect()

        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        
        # Find candidates older than 30 days
        expired_candidates = await prisma.candidate.find_many(
            where={
                "createdAt": {"lt": cutoff}
            },
            include={
                "campaign": True,
                "evaluation": True
            }
        )
        
        if not expired_candidates:
            logger.info("No expired candidates found to sweep.")
            return

        deleted_count = 0
        resume_deleted_count = 0

        for candidate in expired_candidates:
            try:
                # 1. Create Analytics Record
                await prisma.candidateanalytics.create(
                    data={
                        "campaignId": candidate.campaignId,
                        "campaignTitle": candidate.campaign.title if candidate.campaign else "Unknown",
                        "status": candidate.status,
                        "fitScore": candidate.fitScore,
                        "overallScore": candidate.evaluation.overallScore if candidate.evaluation else None,
                        "exitStage": candidate.status
                    }
                )
                
                resume_id = candidate.resumeId
                
                # 2. Delete Candidate (cascades Evaluation because of onDelete: Cascade in schema)
                await prisma.candidate.delete(
                    where={"id": candidate.id}
                )
                deleted_count += 1
                
                # 3. Clean up orphaned Resume
                if resume_id:
                    links = await prisma.candidate.count(
                        where={"resumeId": resume_id}
                    )
                    if links == 0:
                        await prisma.resume.delete(
                            where={"id": resume_id}
                        )
                        resume_deleted_count += 1
            except Exception as e:
                logger.error(f"Failed to process deletion for candidate {candidate.id}: {e}")

        logger.info(f"Sweeper finished: Deleted {deleted_count} candidates and {resume_deleted_count} orphaned resumes.")

    except Exception as e:
        logger.error(f"Error running hard_delete_expired_candidates: {e}")

async def sweep_stale_overrides(ctx=None):
    """
    Finds candidates stuck in 'pending' or 'hold' decision for > 14 days and auto-rejects them.
    (Note: This just updates DB status. If LangGraph is waiting, it will naturally be ignored once hard deleted.)
    """
    try:
        if not prisma.is_connected():
            await prisma.connect()
            
        cutoff = datetime.now(timezone.utc) - timedelta(days=14)
        
        stale_holds = await prisma.candidate.update_many(
            where={
                "decision": "hold",
                "updatedAt": {"lt": cutoff}
            },
            data={
                "decision": "reject",
                "status": "rejected",
                "rejectionReason": "Auto-rejected after 14 days of inactivity."
            }
        )
        
        if stale_holds > 0:
            logger.info(f"Swept {stale_holds} stale human overrides to rejected.")
            
    except Exception as e:
        logger.error(f"Error running sweep_stale_overrides: {e}")

async def run_all_sweepers(ctx=None):
    """Entry point for the arq cron job"""
    await sweep_stale_overrides(ctx)
    await hard_delete_expired_candidates(ctx)

if __name__ == "__main__":
    # For manual testing
    import sys
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        
    async def main():
        await run_all_sweepers()
        await prisma.disconnect()
        
    asyncio.run(main())

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

        # 1. Prepare batch analytics payload & collect IDs
        analytics_payload = []
        candidate_ids = []
        possible_resume_ids = set()

        for c in expired_candidates:
            candidate_ids.append(c.id)
            if c.resumeId:
                possible_resume_ids.add(c.resumeId)
            analytics_payload.append({
                "campaignId": c.campaignId,
                "campaignTitle": c.campaign.title if c.campaign else "Unknown",
                "status": c.status,
                "fitScore": c.fitScore,
                "overallScore": c.evaluation.overallScore if c.evaluation else None,
                "exitStage": c.status
            })

        # 2. Batch insert analytics records
        if analytics_payload:
            await prisma.candidateanalytics.create_many(data=analytics_payload)

        # 3. Batch delete candidates
        delete_result = await prisma.candidate.delete_many(
            where={"id": {"in": candidate_ids}}
        )
        deleted_count = delete_result

        # 4. Clean up orphaned resumes in batch
        resume_deleted_count = 0
        if possible_resume_ids:
            active_links = await prisma.candidate.find_many(
                where={"resumeId": {"in": list(possible_resume_ids)}},
                distinct=["resumeId"]
            )
            linked_resume_ids = {c.resumeId for c in active_links if c.resumeId}
            orphaned_ids = list(possible_resume_ids - linked_resume_ids)

            if orphaned_ids:
                resume_deleted_count = await prisma.resume.delete_many(
                    where={"id": {"in": orphaned_ids}}
                )

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

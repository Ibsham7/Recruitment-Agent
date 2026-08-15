import asyncio
import logging
from datetime import datetime, timedelta, timezone
from app.database import prisma
from app.services.r2_service import delete_r2_object_by_url, delete_r2_campaign_folder

logger = logging.getLogger(__name__)

async def hard_delete_expired_candidates(ctx=None):
    """
    Sweeps the database and Cloudflare R2 object storage for campaigns/candidates older than 30 days.
    - Copies anonymous statistics to CandidateAnalytics
    - Deletes campaign resume folders and individual resume files from Cloudflare R2
    - Hard deletes Candidate and expired Campaign records in DB (cascading to Evaluation)
    """
    try:
        if not prisma.is_connected():
            await prisma.connect()

        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        
        # 1. Find candidates older than 30 days
        expired_candidates = await prisma.candidate.find_many(
            where={
                "createdAt": {"lt": cutoff}
            },
            include={
                "campaign": True,
                "evaluation": True
            }
        )
        
        if expired_candidates:
            analytics_payload = []
            candidate_ids = []
            possible_resume_ids = set()
            campaign_ids_to_clean = set()
            individual_cv_urls = set()

            for c in expired_candidates:
                candidate_ids.append(c.id)
                if c.campaignId:
                    campaign_ids_to_clean.add(c.campaignId)
                if c.cvUrl:
                    individual_cv_urls.add(c.cvUrl)
                if hasattr(c, 'resumeId') and c.resumeId:
                    possible_resume_ids.add(c.resumeId)

                analytics_payload.append({
                    "campaignId": c.campaignId,
                    "campaignTitle": c.campaign.title if c.campaign else "Unknown",
                    "status": c.status,
                    "fitScore": c.fitScore,
                    "overallScore": c.evaluation.overallScore if c.evaluation else None,
                    "exitStage": c.status
                })

            # Save anonymous metrics
            if analytics_payload:
                await prisma.candidateanalytics.create_many(data=analytics_payload)

            # Purge R2 Storage
            r2_deleted_files_count = 0
            for camp_id in campaign_ids_to_clean:
                count = delete_r2_campaign_folder(camp_id)
                r2_deleted_files_count += count

            for cv_url in individual_cv_urls:
                # Delete any legacy flat resumes or individual URLs if still present
                delete_r2_object_by_url(cv_url)

            # Hard delete DB candidates
            delete_result = await prisma.candidate.delete_many(
                where={"id": {"in": candidate_ids}}
            )
            deleted_count = delete_result

            logger.info(f"[Sweeper] Purged {deleted_count} candidate DB records and ~{r2_deleted_files_count} R2 storage files.")

        # 2. Find and purge expired campaigns with no remaining candidates
        expired_campaigns = await prisma.campaign.find_many(
            where={
                "createdAt": {"lt": cutoff}
            }
        )
        if expired_campaigns:
            for camp in expired_campaigns:
                delete_r2_campaign_folder(camp.id)
            
            expired_camp_ids = [c.id for c in expired_campaigns]
            await prisma.campaign.delete_many(
                where={"id": {"in": expired_camp_ids}}
            )
            logger.info(f"[Sweeper] Purged {len(expired_campaigns)} expired campaigns older than 30 days.")

    except Exception as e:
        logger.error(f"Error running hard_delete_expired_candidates: {e}")

async def sweep_stale_overrides(ctx=None):
    """
    Finds candidates stuck in 'pending' or 'hold' decision for > 14 days and auto-rejects them.
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
    import sys
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        
    async def main():
        await run_all_sweepers()
        await prisma.disconnect()
        
    asyncio.run(main())

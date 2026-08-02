import os
import sys
import asyncio
from urllib.parse import urlparse, urlunparse

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from arq.connections import RedisSettings
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from app.core.logging import setup_logging, candidate_id_ctx

# Initialize logging configuration for the worker process
setup_logging()

from app.agent.api import start_candidate_pipeline, resume_pipeline
from app.database import prisma, init_db_pool, close_db_pool, get_global_checkpointer
from app.agent.state import RecruitmentState
from arq.cron import cron
from app.sweeper import run_all_sweepers

async def startup(ctx):
    """
    Connect to the database and set up any required resources
    when the worker process starts.
    """
    setup_logging()
    await prisma.connect()
    await init_db_pool()
    ctx['checkpointer'] = get_global_checkpointer()

async def shutdown(ctx):
    """
    Clean up resources when the worker process stops.
    """
    await prisma.disconnect()
    await close_db_pool()

async def process_cv_task(ctx, candidate_id: str, cv_url: str, jd_text: str):
    """
    Background job to process a candidate's CV.
    """
    candidate_id_ctx.set(candidate_id)
    try:
        await start_candidate_pipeline(candidate_id, cv_url, jd_text, checkpointer=ctx.get('checkpointer'))
    finally:
        candidate_id_ctx.set("")
    
async def resume_pipeline_task(ctx, candidate_id: str, resume_data: str):
    """
    Background job to resume a pipeline for an interview answer.
    """
    candidate_id_ctx.set(candidate_id)
    try:
        await resume_pipeline(candidate_id, resume_data, checkpointer=ctx.get('checkpointer'))
    finally:
        candidate_id_ctx.set("")

def _get_redis_settings() -> RedisSettings:
    url = os.getenv("REDIS_URL", "redis://localhost:6379")
    settings = RedisSettings.from_dsn(url)
    settings.conn_timeout = 10
    settings.conn_retries = 5
    return settings

MAX_CONCURRENT_PIPELINES = int(os.getenv("MAX_CONCURRENT_PIPELINES", "3"))

class WorkerSettings:
    """
    ARQ Worker Settings.
    This class is read by the `arq app.worker.WorkerSettings` command.
    """
    functions = [process_cv_task, resume_pipeline_task]
    cron_jobs = [
        cron(run_all_sweepers, hour={2, 14}, minute=0) # Run at 2 AM and 2 PM
    ]
    redis_settings = _get_redis_settings()
    on_startup = startup
    on_shutdown = shutdown
    max_jobs = MAX_CONCURRENT_PIPELINES
    job_timeout = 3600  # Allow up to 1 hour for a pipeline to complete

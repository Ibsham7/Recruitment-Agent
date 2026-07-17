import os
import sys
import asyncio

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from arq.connections import RedisSettings
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from app.agent.api import start_candidate_pipeline, resume_pipeline
from app.database import prisma
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg_pool import AsyncConnectionPool
from app.agent.state import RecruitmentState
from arq.cron import cron
from app.sweeper import run_all_sweepers

async def startup(ctx):
    """
    Connect to the database and set up any required resources
    when the worker process starts.
    """
    await prisma.connect()
    
    db_url = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")
    if db_url:
        db_url = db_url.replace("?pgbouncer=true", "").replace("&pgbouncer=true", "")
        
    pool = AsyncConnectionPool(
        conninfo=db_url,
        max_size=20,
        open=False,
        kwargs={
            "autocommit": True,
            "prepare_threshold": 0,
        },
    )
    await pool.open()
    await pool.wait()
    ctx['pool'] = pool
    checkpointer = AsyncPostgresSaver(pool)
    await checkpointer.setup()
    ctx['checkpointer'] = checkpointer

async def shutdown(ctx):
    """
    Clean up resources when the worker process stops.
    """
    await prisma.disconnect()
    if 'pool' in ctx:
        await ctx['pool'].close()

async def process_cv_task(ctx, candidate_id: str, cv_url: str, jd_text: str):
    """
    Background job to process a candidate's CV.
    """
    await start_candidate_pipeline(candidate_id, cv_url, jd_text, checkpointer=ctx.get('checkpointer'))
    
async def resume_pipeline_task(ctx, candidate_id: str, resume_data: str):
    """
    Background job to resume a pipeline for an interview answer.
    """
    await resume_pipeline(candidate_id, resume_data, checkpointer=ctx.get('checkpointer'))

# Setup Redis Connection
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
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
    redis_settings = RedisSettings.from_dsn(REDIS_URL)
    on_startup = startup
    on_shutdown = shutdown
    max_jobs = MAX_CONCURRENT_PIPELINES
    job_timeout = 3600  # Allow up to 1 hour for a pipeline to complete

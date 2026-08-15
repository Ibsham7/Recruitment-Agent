import os
from urllib.parse import urlparse, urlunparse
from prisma import Prisma
from psycopg_pool import AsyncConnectionPool
from psycopg.rows import dict_row
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from arq import create_pool
from arq.connections import RedisSettings

prisma = Prisma()

_pool: AsyncConnectionPool | None = None
_checkpointer: AsyncPostgresSaver | None = None
_redis_pool = None

def get_redis_settings() -> RedisSettings:
    url = os.getenv("REDIS_URL", "redis://localhost:6379")
    settings = RedisSettings.from_dsn(url)
    settings.conn_timeout = 10
    settings.conn_retries = 5
    if url.startswith("rediss://"):
        settings.ssl_cert_reqs = "none"
    return settings

async def get_redis_pool():
    global _redis_pool
    if _redis_pool is None:
        try:
            _redis_pool = await create_pool(get_redis_settings())
        except Exception:
            return None
    return _redis_pool

def get_db_url() -> str:
    return os.environ.get("DATABASE_URL") or os.environ.get("DIRECT_URL") or ""

async def init_db_pool():
    global _pool, _checkpointer
    db_url = get_db_url()
    max_pool_size = int(os.environ.get("DB_POOL_MAX_SIZE", "20"))
    min_pool_size = int(os.environ.get("DB_POOL_MIN_SIZE", "2"))
    if db_url and _pool is None:
        _pool = AsyncConnectionPool(
            conninfo=db_url,
            min_size=min_pool_size,
            max_size=max_pool_size,
            open=False,
            kwargs={
                "autocommit": True,
                "prepare_threshold": None,
                "row_factory": dict_row,
            },
        )
        await _pool.open()
        await _pool.wait()
        _checkpointer = AsyncPostgresSaver(_pool)
        try:
            await _checkpointer.setup()
        except Exception:
            # Handle idempotent schema setup if migration key already exists
            pass

async def close_db_pool():
    global _pool, _checkpointer
    if _pool is not None:
        await _pool.close()
        _pool = None
        _checkpointer = None

def get_global_checkpointer() -> AsyncPostgresSaver | None:
    return _checkpointer


import os
from urllib.parse import urlparse, urlunparse
from prisma import Prisma
from psycopg_pool import AsyncConnectionPool
from psycopg.rows import dict_row
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

prisma = Prisma()

_pool: AsyncConnectionPool | None = None
_checkpointer: AsyncPostgresSaver | None = None

def get_db_url() -> str:
    raw_db_url = os.environ.get("DATABASE_URL") or os.environ.get("DIRECT_URL") or ""
    if raw_db_url:
        parsed = urlparse(raw_db_url)
        # Strip query parameters for psycopg driver compatibility
        return urlunparse((parsed.scheme, parsed.netloc, parsed.path, '', '', ''))
    return ""

async def init_db_pool():
    global _pool, _checkpointer
    db_url = get_db_url()
    if db_url and _pool is None:
        _pool = AsyncConnectionPool(
            conninfo=db_url,
            min_size=1,
            max_size=5,
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
        except Exception as e:
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


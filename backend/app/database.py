import os
import sys
import asyncio
from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse
from prisma import Prisma
from psycopg_pool import AsyncConnectionPool
from psycopg.rows import dict_row
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from arq import create_pool
from arq.connections import RedisSettings

if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:
        pass

prisma = Prisma()

_pool: AsyncConnectionPool | None = None
_checkpointer: AsyncPostgresSaver | None = None
_redis_pool = None

try:
    import psycopg.pq
    VALID_LIBPQ_PARAMS = {opt.keyword.decode() for opt in psycopg.pq.Conninfo.get_defaults()}
except Exception:
    VALID_LIBPQ_PARAMS = {
        "service", "user", "password", "passfile", "channel_binding", "connect_timeout",
        "dbname", "host", "hostaddr", "port", "client_encoding", "options", "application_name",
        "fallback_application_name", "keepalives", "keepalives_idle", "keepalives_interval",
        "keepalives_count", "tcp_user_timeout", "sslmode", "sslnegotiation", "sslcompression",
        "sslcert", "sslkey", "sslcertmode", "sslpassword", "sslrootcert", "sslcrl",
        "sslcrldir", "sslsni", "requirepeer", "require_auth", "min_protocol_version",
        "max_protocol_version", "ssl_min_protocol_version", "ssl_max_protocol_version",
        "gssencmode", "krbsrvname", "gsslib", "gssdelegation", "replication",
        "target_session_attrs", "load_balance_hosts", "scram_client_key", "scram_server_key",
    }

def clean_db_url(raw_url: str) -> str:
    """Sanitize database connection URL for psycopg by removing query parameters
    not supported by libpq (e.g. Prisma's `pgbouncer=true`, `connection_limit`, `schema`, etc.)."""
    if not raw_url:
        return ""
    parsed = urlparse(raw_url)
    if not parsed.query:
        return raw_url
    query_params = parse_qsl(parsed.query, keep_blank_values=True)
    filtered_params = [(k, v) for k, v in query_params if k.lower() in VALID_LIBPQ_PARAMS]
    new_query = urlencode(filtered_params)
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, new_query, parsed.fragment))

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
    raw = os.environ.get("DATABASE_URL") or os.environ.get("DIRECT_URL") or ""
    return clean_db_url(raw)

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


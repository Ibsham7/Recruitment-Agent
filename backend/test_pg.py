import asyncio
import sys

if sys.platform == 'win32':
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:
        pass

from app.database import get_db_url, clean_db_url, init_db_pool, close_db_pool, get_global_checkpointer

def test_clean_db_url():
    url = "postgresql://user:pass@host:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require"
    cleaned = clean_db_url(url)
    assert "pgbouncer" not in cleaned, "pgbouncer should be stripped"
    assert "connection_limit" not in cleaned, "connection_limit should be stripped"
    assert "sslmode=require" in cleaned, "sslmode should be preserved"

async def test_db_pool():
    db_url = get_db_url()
    assert "pgbouncer" not in db_url, "pgbouncer should not be in db_url"
    await init_db_pool()
    cp = get_global_checkpointer()
    assert cp is not None, "Checkpointer should be initialized"
    await close_db_pool()

if __name__ == "__main__":
    test_clean_db_url()
    asyncio.run(test_db_pool())
    print("Database & pool tests passed successfully!")


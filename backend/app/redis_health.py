"""Hourly dependency sampling; HTTP probes read only the cached snapshot."""
import asyncio
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class RedisHealth:
    def __init__(self):
        self.snapshot = {
            "redis_connected": None,
            "pending_queue_jobs": None,
            "redis_checked_at": None,
        }

    async def refresh(self, pool):
        connected, depth = False, None
        try:
            await pool.ping()
            depth = await pool.zcard("arq:queue")
            connected = True
        except Exception:
            logger.warning("Redis health sample failed")
        self.snapshot = {
            "redis_connected": connected,
            "pending_queue_jobs": depth,
            "redis_checked_at": datetime.now(timezone.utc).isoformat(),
        }

    async def run(self, pool):
        while True:
            await self.refresh(pool)
            await asyncio.sleep(3600)

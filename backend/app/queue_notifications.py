"""Process-local hints only; Redis remains the durable source of jobs."""
import logging
from collections.abc import Callable

logger = logging.getLogger(__name__)
_listeners: set[Callable[[], None]] = set()


def subscribe(callback: Callable[[], None]) -> Callable[[], None]:
    _listeners.add(callback)
    return lambda: _listeners.discard(callback)


async def enqueue_job(pool, function: str, *args, **kwargs):
    job = await pool.enqueue_job(function, *args, **kwargs)
    if job is not None:
        for callback in tuple(_listeners):
            try:
                callback()
            except Exception:
                # A failed local hint must never turn a successful durable enqueue
                # into a reported failure (which could cause duplicate submissions).
                logger.error("Queue notification failed; idle polling will recover")
    return job

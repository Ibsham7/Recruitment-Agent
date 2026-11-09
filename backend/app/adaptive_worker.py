"""ARQ 0.28 adapter: gate queue reads, not task maintenance or cron ticks."""
import logging
import asyncio
import math
import os
import signal
from dataclasses import dataclass
from time import monotonic

from arq.worker import Worker, get_kwargs
from app.queue_notifications import subscribe

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PollingConfig:
    active: float = 0.5
    idle: float = 30.0
    grace: float = 5.0
    adaptive: bool = True

    def __post_init__(self):
        if any(not math.isfinite(v) or v <= 0 for v in (self.active, self.idle, self.grace)):
            raise ValueError("ARQ polling intervals must be finite and positive")
        if self.idle < self.active:
            raise ValueError("ARQ_IDLE_POLL_SECONDS must be >= ARQ_ACTIVE_POLL_SECONDS")

    @classmethod
    def from_env(cls):
        enabled = os.getenv("ARQ_ADAPTIVE_POLLING", "true").lower()
        if enabled not in {"true", "false"}:
            raise ValueError("ARQ_ADAPTIVE_POLLING must be true or false")
        return cls(
            active=float(os.getenv("ARQ_ACTIVE_POLL_SECONDS", "0.5")),
            idle=float(os.getenv("ARQ_IDLE_POLL_SECONDS", "30")),
            grace=float(os.getenv("ARQ_ACTIVE_GRACE_SECONDS", "5")),
            adaptive=enabled == "true",
        )


class AdaptiveWorker(Worker):
    def __init__(self, *args, polling=None, clock=monotonic, **kwargs):
        self.polling = polling or PollingConfig.from_env()
        kwargs["poll_delay"] = self.polling.active if self.polling.adaptive else self.polling.idle
        super().__init__(*args, **kwargs)
        self._clock = clock
        self._next_idle_poll = float("-inf")
        self._active_until = float("-inf")
        self._wake_requested = False

    def notify(self):
        self._wake_requested = True

    async def main(self):
        unsubscribe = subscribe(self.notify)
        logger.info(
            "ARQ worker started mode=%s adaptive=%s active=%ss idle=%ss grace=%ss",
            "embedded" if self.ctx.get("embedded") else "standalone",
            self.polling.adaptive, self.polling.active, self.polling.idle, self.polling.grace,
        )
        try:
            await super().main()
        finally:
            unsubscribe()
            logger.info("ARQ worker stopped")

    async def _poll_iteration(self):
        now = self._clock()
        if (
            self.polling.adaptive and not self.burst and not self.tasks
            and not self.allow_abort_jobs and not self._wake_requested
            and now >= self._active_until and now < self._next_idle_poll
        ):
            # Heartbeat performs Redis I/O only when due (hourly by default).
            # Cron checks stay at their original cadence, including while idle.
            await self.heart_beat()
            return

        had_tasks = bool(self.tasks)
        notified = self._wake_requested
        self._wake_requested = False  # Do not erase hints arriving during await.
        await super()._poll_iteration()
        now = self._clock()
        if notified or had_tasks or self.tasks:
            self._active_until = now + self.polling.grace
        self._next_idle_poll = now + self.polling.idle

    async def run_cron(self, *args, **kwargs):
        scheduled = [(job, job.next_run) for job in self.cron_jobs]
        await super().run_cron(*args, **kwargs)
        if any(previous is not None and job.next_run != previous for job, previous in scheduled):
            # ARQ just enqueued a scheduled job, possibly deferred by one tick.
            self.notify()

    def handle_sig(self, signum):
        # Cancel business coroutines, leaving ARQ's run_job wrappers alive to
        # persist retry/finish bookkeeping before their Redis pool is closed.
        self.allow_pick_jobs = False
        logger.info("Stopping ARQ worker on %s", signal.Signals(signum).name)
        for task in tuple(self.job_tasks.values()):
            task.cancel()
        if self.main_task is not None:
            self.main_task.cancel()
        if self.on_stop:
            self.on_stop(signal.Signals(signum))

    async def close(self):
        self.handle_sig(signal.SIGTERM)
        results = await asyncio.gather(*self.tasks.values(), return_exceptions=True)
        if any(isinstance(result, Exception) for result in results):
            logger.error("ARQ job wrapper failed during shutdown")
        self.tasks.clear()
        # Avoid base close's second cancellation and Unix-only SIGUSR1.
        handles_signals = self._handle_signals
        self._handle_signals = True
        try:
            await super().close()
        finally:
            self._handle_signals = handles_signals


def create_adaptive_worker(settings, *, embedded=False, **overrides):
    options = get_kwargs(settings)
    options.update(overrides)
    options["handle_signals"] = not embedded
    options["ctx"] = {**options.get("ctx", {}), "embedded": embedded}
    return AdaptiveWorker(**options)

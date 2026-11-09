"""Opt-in tests against disposable local Redis, never REDIS_URL/Upstash.

Start Redis on 127.0.0.1:16379 and set RUN_LOCAL_REDIS_TESTS=true.
"""
import asyncio
import os
import time
from contextlib import suppress
from uuid import uuid4

import pytest
from arq import Retry, create_pool
from arq.connections import RedisSettings
from arq.worker import Worker, func

from app.adaptive_worker import AdaptiveWorker, PollingConfig
from app.queue_notifications import enqueue_job

pytestmark = pytest.mark.skipif(os.getenv("RUN_LOCAL_REDIS_TESTS") != "true", reason="requires disposable local Redis")


async def wait_until(predicate, timeout=5):
    end = time.monotonic() + timeout
    while not predicate():
        if time.monotonic() >= end:
            raise AssertionError("Timed out waiting for local worker")
        await asyncio.sleep(0.01)


async def exercise(adaptive, default_intervals=False):
    settings = RedisSettings(host="127.0.0.1", port=16379, conn_retries=0)
    producer = await create_pool(settings)
    namespace = "redis-test-" + uuid4().hex
    queue = namespace + ":queue"
    completed, starts = [], []
    active, peak = 0, 0

    async def process_cv_task(ctx, candidate_id, cv_url, jd):
        nonlocal active, peak
        assert cv_url == "stub.pdf" and jd == "stub JD"
        active += 1
        peak = max(peak, active)
        starts.append(time.monotonic())
        try:
            if candidate_id == "interrupted" and ctx["job_try"] == 1:
                await asyncio.Event().wait()
            await asyncio.sleep(0.06)
            completed.append(candidate_id)
        finally:
            active -= 1

    async def process_evaluator_task(ctx, candidate_id):
        completed.append(candidate_id)

    async def resume_pipeline_task(ctx, candidate_id, resume_data):
        if ctx["job_try"] == 1:
            raise Retry(defer=0.15)
        completed.append(candidate_id)

    async def start_worker():
        pool = await create_pool(settings)
        kwargs = dict(
            functions=[
                func(process_cv_task, name="process_cv_task"),
                func(process_evaluator_task, name="process_evaluator_task"),
                func(resume_pipeline_task, name="resume_pipeline_task"),
            ],
            redis_pool=pool, queue_name=queue, handle_signals=False,
            max_jobs=3, keep_result=0, job_timeout=5,
        )
        if adaptive:
            polling = PollingConfig() if default_intervals else PollingConfig(active=0.05, idle=0.6, grace=0.1)
            worker = AdaptiveWorker(**kwargs, polling=polling)
        else:
            worker = Worker(**kwargs, poll_delay=0.05)
        task = asyncio.create_task(worker.async_run())
        await wait_until(lambda: worker._last_health_check > 0)
        return worker, task

    async def stop_worker(worker, task):
        if isinstance(worker, AdaptiveWorker):
            await worker.close()
        else:
            # ARQ's base close references Unix-only SIGUSR1 on Windows.
            await wait_until(lambda: not worker.tasks)
            from signal import SIGTERM
            worker.handle_sig(SIGTERM)
            worker._handle_signals = True
            await worker.close()
        with suppress(asyncio.CancelledError):
            await task

    worker = task = None
    async def submit(function, *args, notify=True):
        job_id = namespace + ":" + uuid4().hex
        if notify:
            return await enqueue_job(producer, function, *args, _queue_name=queue, _job_id=job_id)
        return await producer.enqueue_job(function, *args, _queue_name=queue, _job_id=job_id)

    try:
        # Backlog survives absence of a worker; no local hint is available.
        await submit("process_cv_task", "startup", "stub.pdf", "stub JD", notify=False)
        worker, task = await start_worker()
        await wait_until(lambda: "startup" in completed)
        await asyncio.sleep(5.6 if default_intervals else 0.75)  # let worker become idle
        submitted = time.monotonic()
        for i in range(9):
            await submit("process_cv_task", str(i), "stub.pdf", "stub JD")
        await wait_until(lambda: all(str(i) in completed for i in range(9)))
        batch_time = time.monotonic() - submitted
        pickup = min(t for t in starts if t >= submitted) - submitted
        assert pickup < 1
        assert peak == 3
        assert worker.jobs_failed == 0

        await submit("process_evaluator_task", "evaluation")
        await submit("resume_pipeline_task", "retry", "override")
        await wait_until(lambda: "evaluation" in completed and "retry" in completed)
        assert worker.jobs_retried == 1
        await asyncio.sleep(0.75)
        submitted = time.monotonic()
        await submit("process_evaluator_task", "external", notify=False)
        await wait_until(lambda: "external" in completed)
        assert time.monotonic() - submitted < 1

        if adaptive:
            await submit("process_cv_task", "interrupted", "stub.pdf", "stub JD")
            await wait_until(lambda: active > 0)
        await stop_worker(worker, task)
        worker = task = None
        await submit("process_evaluator_task", "restart", notify=False)
        worker, task = await start_worker()
        await wait_until(lambda: "restart" in completed)
        if adaptive:
            await wait_until(lambda: "interrupted" in completed)
        assert len(completed) == len(set(completed))
        return batch_time, pickup
    finally:
        if worker is not None:
            await stop_worker(worker, task)
        # Delete only this test's uniquely named keys; never flush the database.
        keys = [key async for key in producer.scan_iter(match="*" + namespace + "*")]
        if keys:
            await producer.delete(*keys)
        await producer.aclose(close_connection_pool=True)


def test_local_redis_end_to_end_and_throughput():
    async def check():
        standard, _ = await exercise(False)
        adaptive, pickup = await exercise(True)
        print(f"\nLocal Redis batch: standard={standard:.3f}s adaptive={adaptive:.3f}s pickup={pickup:.3f}s")
        assert adaptive < standard + 0.3
    asyncio.run(check())


def test_default_intervals_immediate_pickup():
    # Real default 0.5s ticks / 30s idle fallback, not just scaled test timers.
    async def check():
        _, pickup = await exercise(True, default_intervals=True)
        assert pickup < 1
    asyncio.run(check())

"""Offline regressions for idle usage, notifications, and resource ownership."""
import asyncio
from datetime import datetime, timedelta, timezone
from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import httpx
import pytest
from arq.cron import cron

from app.adaptive_worker import AdaptiveWorker, PollingConfig, create_adaptive_worker
from app.queue_notifications import enqueue_job, subscribe
from app.redis_config import get_redis_url
from app.redis_health import RedisHealth


async def noop(ctx):
    pass


def make_worker(**kwargs):
    pool = SimpleNamespace(zrangebyscore=AsyncMock(return_value=[]))
    clock = [0.0]
    worker = AdaptiveWorker(
        [noop], queue_name="arq:queue", redis_pool=pool, handle_signals=False,
        clock=lambda: clock[0], **kwargs,
    )
    worker.heart_beat = AsyncMock()
    return worker, pool, clock


def test_idle_reads_and_fallback_discovery():
    async def check():
        worker, pool, clock = make_worker()
        for tick in range(121):
            clock[0] = tick / 2
            await worker._poll_iteration()
        assert pool.zrangebyscore.await_count == 3  # startup, 30, 60
        assert worker.heart_beat.await_count == 121
        assert 31 * 86400 / 30 + 31 * 24 * 3 < 100_000
    asyncio.run(check())


def test_notifications_coalesce_and_survive_an_await():
    async def check():
        worker, pool, clock = make_worker()
        await worker._poll_iteration()
        clock[0] = 0.5
        producer = SimpleNamespace(enqueue_job=AsyncMock(return_value=object()))
        unsubscribe = subscribe(worker.notify)
        try:
            for _ in range(3):
                await enqueue_job(producer, "process_cv_task", "candidate")
            async def read(*args, **kwargs):
                worker.notify()  # another submission while queue read is awaiting
                return []
            pool.zrangebyscore.side_effect = read
            await worker._poll_iteration()
            assert pool.zrangebyscore.await_count == 2
            assert worker._wake_requested
            pool.zrangebyscore.side_effect = None
            clock[0] = 1
            await worker._poll_iteration()
            assert not worker._wake_requested
            clock[0] = 1.5
            await worker._poll_iteration()
            assert pool.zrangebyscore.await_count == 4  # active grace
            clock[0] = 6
            await worker._poll_iteration()
            assert pool.zrangebyscore.await_count == 4  # quiet again
        finally:
            unsubscribe()
    asyncio.run(check())


def test_enqueue_result_errors_and_hint_failure():
    async def check():
        callback = Mock()
        unsubscribe = subscribe(callback)
        pool = SimpleNamespace(enqueue_job=AsyncMock(return_value=None))
        try:
            assert await enqueue_job(pool, "job", 1) is None
            callback.assert_not_called()
            pool.enqueue_job.side_effect = RuntimeError("unavailable")
            with pytest.raises(RuntimeError):
                await enqueue_job(pool, "job", 1)
            callback.assert_not_called()
            pool.enqueue_job.side_effect = None
            job = object()
            pool.enqueue_job.return_value = job
            callback.side_effect = ValueError("broken hint")
            assert await enqueue_job(pool, "job", 1, _job_id="stable") is job
            pool.enqueue_job.assert_awaited_with("job", 1, _job_id="stable")
        finally:
            unsubscribe()
    asyncio.run(check())


def test_full_capacity_completion_does_not_enter_idle_sleep():
    async def check():
        worker, pool, clock = make_worker(max_jobs=3)
        worker.tasks = {str(i): asyncio.create_task(noop({})) for i in range(3)}
        await asyncio.gather(*worker.tasks.values())
        worker.job_counter = 3
        await worker._poll_iteration()  # harvest completed tasks, full counter skips read
        assert not worker.tasks
        worker.job_counter = 0  # ARQ completion callbacks release execution slots
        clock[0] = 0.5
        await worker._poll_iteration()
        assert pool.zrangebyscore.await_count == 1
        worker.allow_pick_jobs = False
        worker.notify()
        clock[0] = 1
        await worker._poll_iteration()
        assert pool.zrangebyscore.await_count == 1
        assert not worker.allow_pick_jobs
    asyncio.run(check())


def test_cron_remains_live_and_wakes_worker():
    async def check():
        worker, pool, clock = make_worker(cron_jobs=[cron(noop, hour={2, 14}, minute=0)])
        worker.record_health = AsyncMock()
        worker.heart_beat = AdaptiveWorker.heart_beat.__get__(worker)
        pool.enqueue_job = AsyncMock(return_value=object())
        now = datetime.now(timezone.utc)
        worker.cron_jobs[0].next_run = now - timedelta(seconds=1)
        worker._next_idle_poll = 30
        await worker._poll_iteration()  # idle: cron enqueue, no queue read
        pool.enqueue_job.assert_awaited_once()
        assert worker._wake_requested
        clock[0] = 0.5
        await worker._poll_iteration()
        assert pool.zrangebyscore.await_count == 1
    asyncio.run(check())


@pytest.mark.parametrize("values", [dict(active=0), dict(idle=-1), dict(grace=0), dict(active=float("nan")), dict(idle=0.1)])
def test_invalid_intervals(values):
    with pytest.raises(ValueError):
        PollingConfig(**values)


def test_factory_and_rollback(monkeypatch):
    monkeypatch.setenv("ARQ_ADAPTIVE_POLLING", "false")
    class Settings:
        functions = [noop]
    async def check():
        worker = create_adaptive_worker(Settings, embedded=True)
        assert isinstance(worker, AdaptiveWorker)
        assert worker.poll_delay_s == 30
        assert worker.ctx["embedded"]
        assert not worker._handle_signals
        standalone = create_adaptive_worker(Settings)
        assert not standalone.ctx["embedded"]
    # Do not install standalone signal handlers on pytest's loop.
    monkeypatch.setattr(AdaptiveWorker, "_add_signal_handler", Mock())
    asyncio.run(check())


def test_development_redis_requires_explicit_opt_in(monkeypatch):
    monkeypatch.delenv("RENDER", raising=False)
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("REDIS_URL", "rediss://example.upstash.io:6379")
    monkeypatch.delenv("REDIS_DEV_URL", raising=False)
    monkeypatch.delenv("ALLOW_REMOTE_REDIS_IN_DEV", raising=False)
    assert get_redis_url() == "redis://localhost:6379"
    monkeypatch.setenv("ALLOW_REMOTE_REDIS_IN_DEV", "true")
    assert "upstash.io" in get_redis_url()
    monkeypatch.setenv("ALLOW_REMOTE_REDIS_IN_DEV", "false")
    monkeypatch.setenv("APP_ENV", "production")
    assert "upstash.io" in get_redis_url()
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("RENDER", "true")
    assert "upstash.io" in get_redis_url()


def test_health_cache_sampling_and_http_probes(monkeypatch):
    from app.main import app
    async def check():
        cache = RedisHealth()
        pool = SimpleNamespace(ping=AsyncMock(), zcard=AsyncMock(return_value=7))
        assert cache.snapshot["redis_connected"] is None
        await cache.refresh(pool)
        monkeypatch.setattr(app.state, "redis_health", cache, raising=False)
        monkeypatch.setattr(app.state, "redis", pool, raising=False)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            for path in ("/health", "/api/health"):
                for _ in range(5):
                    response = await client.get(path)
                    assert response.json()["pending_queue_jobs"] == 7
                    assert response.json()["redis_checked_at"]
                    assert (await client.head(path)).status_code == 200
        assert pool.ping.await_count == pool.zcard.await_count == 1
        pool.ping.side_effect = ConnectionError()
        await cache.refresh(pool)
        assert cache.snapshot["redis_connected"] is False
        assert cache.snapshot["pending_queue_jobs"] is None
    asyncio.run(check())


def test_producer_pool_is_shared_and_closed(monkeypatch):
    from app import database
    async def check():
        pool = SimpleNamespace(aclose=AsyncMock())
        async def connect(*args):
            await asyncio.sleep(0)
            return pool
        factory = AsyncMock(side_effect=connect)
        monkeypatch.setattr(database, "_redis_pool", None)
        monkeypatch.setattr(database, "_redis_lock", asyncio.Lock())
        monkeypatch.setattr(database, "create_pool", factory)
        assert all(p is pool for p in await asyncio.gather(*(database.get_redis_pool() for _ in range(10))))
        factory.assert_awaited_once()
        await database.close_redis_pool()
        await database.close_redis_pool()
        pool.aclose.assert_awaited_once_with(close_connection_pool=True)
        assert database._redis_pool is None
    asyncio.run(check())


@pytest.mark.parametrize("embedded", [True, False])
def test_lifespan_ownership_and_cleanup(monkeypatch, embedded):
    from app import main
    from app.services import r2_service
    async def check():
        producer = object()
        worker = SimpleNamespace()
        worker.async_run = AsyncMock(side_effect=lambda: None)
        # A real awaitable task stays alive until shutdown.
        async def run():
            await asyncio.Event().wait()
        worker.async_run.side_effect = run
        worker.close = AsyncMock()
        factory = Mock(return_value=worker)
        prisma = SimpleNamespace(connect=AsyncMock(), disconnect=AsyncMock(), is_connected=lambda: True)
        monkeypatch.setattr(main, "prisma", prisma)
        monkeypatch.setattr(main, "init_db_pool", AsyncMock())
        monkeypatch.setattr(main, "close_db_pool", AsyncMock())
        monkeypatch.setattr(main, "get_redis_pool", AsyncMock(return_value=producer))
        monkeypatch.setattr(main, "close_redis_pool", AsyncMock())
        monkeypatch.setattr(main, "create_adaptive_worker", factory)
        monkeypatch.setattr(RedisHealth, "refresh", AsyncMock())
        monkeypatch.setattr(r2_service, "ensure_r2_bucket_cors", lambda: None)
        monkeypatch.setenv("ENABLE_EMBEDDED_WORKER", str(embedded).lower())
        async with main.lifespan(main.app):
            await asyncio.sleep(0)
            assert factory.call_count == int(embedded)
            if embedded:
                assert not main.app.state.worker_task.done()
        assert main.app.state.redis_health_task.cancelled()
        main.close_redis_pool.assert_awaited_once()
        main.close_db_pool.assert_awaited_once()
        prisma.disconnect.assert_awaited_once()
        assert worker.close.await_count == int(embedded)
    asyncio.run(check())


def test_campaign_and_retry_keep_payloads_and_notify(monkeypatch):
    from app import main, dev_logger
    from app.agent.nodes import jd_matcher
    from app.agent import embeddings
    from app.services import billing_service
    from fastapi import BackgroundTasks
    async def check():
        campaign = SimpleNamespace(id="campaign", title="Demo", jobDescription="Developer role")
        prisma = SimpleNamespace(
            campaign=SimpleNamespace(create=AsyncMock(return_value=campaign), update=AsyncMock(), find_first=AsyncMock(return_value=campaign)),
            candidate=SimpleNamespace(create_many=AsyncMock(), find_many=AsyncMock(return_value=[
                SimpleNamespace(id="failed", cvUrl="retry.pdf", status="pending"),
                SimpleNamespace(id="rejected", cvUrl="reject.pdf", status="rejected", rejectionReason="Low score"),
            ])), execute_raw=AsyncMock(),
        )
        monkeypatch.setattr(main, "prisma", prisma)
        billing = AsyncMock()
        monkeypatch.setattr(billing_service, "validate_and_deduct_campaign_creation", billing)
        monkeypatch.setattr(jd_matcher, "distill_jd_requirements_with_cost", AsyncMock(return_value=(SimpleNamespace(model_dump=lambda: {}), 0, {})))
        monkeypatch.setattr(embeddings, "_distill_jd_with_cost_async", AsyncMock(return_value=("JD", 0, {})))
        monkeypatch.setattr(embeddings, "get_embedding_with_cost_async", AsyncMock(return_value=([0.0], 0, {})))
        monkeypatch.setattr(dev_logger, "log_event", Mock())
        pool = SimpleNamespace(enqueue_job=AsyncMock(return_value=object()))
        request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(redis=pool)))
        callback = Mock()
        unsubscribe = subscribe(callback)
        try:
            body = main.CampaignCreate(title="Demo", jobDescription="We need an experienced backend developer to build reliable Python APIs.", resumes=["a.pdf", "b.pdf"])
            result = await main.create_campaign(body, request, BackgroundTasks(), {"sub": "user", "email": "demo@example.com"})
            assert result == {"status": "success", "campaignId": "campaign"}
            billing.assert_awaited_once()
            records = prisma.candidate.create_many.call_args.kwargs["data"]
            for record, call in zip(records, pool.enqueue_job.await_args_list):
                assert call.args == ("process_cv_task", record["id"], record["cvUrl"], body.jobDescription)
            assert callback.call_count == 2
            result = await main.retry_failed_candidates("campaign", request, {"sub": "user"})
            assert result["count"] == 1
            pool.enqueue_job.assert_awaited_with("process_cv_task", "failed", "retry.pdf", "Developer role")
            assert callback.call_count == 3
        finally:
            unsubscribe()
    asyncio.run(check())


@pytest.mark.parametrize("availability", ["available", "error", "missing"])
def test_final_answer_evaluation_notification_and_existing_fallback(monkeypatch, availability):
    from app.agent import api
    from app import database
    async def check():
        candidate = SimpleNamespace(
            status="interviewing",
            evaluation=SimpleNamespace(interviewQuestions=[{"question": "Describe your experience"}], interviewTranscript=[]),
        )
        tx = SimpleNamespace(
            execute_raw=AsyncMock(),
            candidate=SimpleNamespace(find_unique=AsyncMock(return_value=candidate), update=AsyncMock()),
            evaluation=SimpleNamespace(update=AsyncMock()),
        )
        @asynccontextmanager
        async def transaction(**kwargs):
            yield tx
        monkeypatch.setattr(api, "prisma", SimpleNamespace(tx=transaction))
        fallback = AsyncMock()
        monkeypatch.setattr(api, "_run_evaluator_background", fallback)
        pool = SimpleNamespace(enqueue_job=AsyncMock(return_value=object()))
        if availability == "error":
            pool.enqueue_job.side_effect = ConnectionError("stub outage")
        monkeypatch.setattr(database, "get_redis_pool", AsyncMock(return_value=None if availability == "missing" else pool))
        callback = Mock()
        unsubscribe = subscribe(callback)
        try:
            await api.process_interview_answer("candidate", "I built reliable backend services with Python and tested the application carefully with my team to support customer requests and improve performance.", expected_turn_index=0)
            await asyncio.sleep(0)
            tx.candidate.update.assert_awaited_with(where={"id": "candidate"}, data={"status": "interview_completed"})
            if availability == "available":
                pool.enqueue_job.assert_awaited_once_with("process_evaluator_task", "candidate")
                callback.assert_called_once()
                fallback.assert_not_awaited()
            else:
                callback.assert_not_called()
                fallback.assert_awaited_once()
        finally:
            unsubscribe()
    asyncio.run(check())

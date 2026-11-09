"""Shared Redis selection; local development never implicitly uses production."""
import os
from arq.connections import RedisSettings


def get_redis_url() -> str:
    production = (
        os.getenv("APP_ENV", "development").lower() == "production"
        or os.getenv("RENDER", "").lower() == "true"
    )
    if production or os.getenv("ALLOW_REMOTE_REDIS_IN_DEV", "false").lower() == "true":
        return os.getenv("REDIS_URL", "redis://localhost:6379")
    return os.getenv("REDIS_DEV_URL", "redis://localhost:6379")


def get_redis_settings() -> RedisSettings:
    settings = RedisSettings.from_dsn(get_redis_url())
    settings.conn_timeout = 15
    settings.conn_retries = 10
    settings.conn_retry_delay = 2
    if get_redis_url().startswith("rediss://"):
        settings.ssl_cert_reqs = "none"
        settings.ssl_check_hostname = False
    return settings

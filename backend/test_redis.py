"""Explicit Redis diagnostic using the same environment policy as the app."""
import asyncio
from dotenv import load_dotenv
from redis.asyncio import Redis
from app.redis_config import get_redis_url


async def main():
    load_dotenv()
    async with Redis.from_url(get_redis_url()) as client:
        print("Redis reachable:", await client.ping())


if __name__ == "__main__":
    asyncio.run(main())

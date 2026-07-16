import asyncio
import redis.asyncio as redis
async def check():
    r = redis.Redis.from_url('rediss://default:gQAAAAAAAah-AAIgcDI0MDU5Mjk4ZTVmYTA0OGQ5YjU1MmExNThlY2RlMGYxMg@allowing-kiwi-108670.upstash.io:6379')
    keys = await r.keys('*')
    print('KEYS:', keys)
asyncio.run(check())

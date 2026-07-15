import asyncio
import sys
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
import os
from dotenv import load_dotenv
load_dotenv()
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

async def test():
    db_url = os.environ.get('DIRECT_URL')
    print('Connecting to:', db_url)
    async with AsyncPostgresSaver.from_conn_string(db_url) as c:
        print('Setting up...')
        await c.setup()
        print('Done!')

asyncio.run(test())

import asyncio
import sys
import pytest
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
import os
from dotenv import load_dotenv
load_dotenv()
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

@pytest.mark.asyncio
async def test():
    db_url = os.environ.get('DIRECT_URL')
    print('Connecting to:', db_url)
    async with AsyncPostgresSaver.from_conn_string(db_url) as c:
        print('Setting up...')
        await c.setup()
        print('Done!')

if __name__ == "__main__":
    asyncio.run(test())

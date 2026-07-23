import asyncio
from app.database import prisma
from app.sweeper import run_all_sweepers

async def run_verification():
    print("\n--- Running Database Optimizations Verification ---")
    await prisma.connect()
    try:
        # 1. Verify indexes in pg_indexes
        print("1. Checking created PostgreSQL indexes...")
        indexes = await prisma.query_raw('''
            SELECT tablename, indexname 
            FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND indexname LIKE 'idx_%';
        ''')
        
        index_names = [idx['indexname'] for idx in indexes]
        print(f" -> Found {len(index_names)} optimization indexes:")
        for idx_name in index_names:
            print(f"    - {idx_name}")

        assert "idx_resume_embedding_hnsw" in index_names, "Missing HNSW vector index on Resume!"
        assert "idx_campaign_jdembedding_hnsw" in index_names, "Missing HNSW vector index on Campaign!"
        assert "idx_resume_structured_profile_gin" in index_names, "Missing GIN index on Resume!"

        # 2. Verify RLS tables
        print("\n2. Checking Row-Level Security (RLS)...")
        rls_tables = await prisma.query_raw('''
            SELECT relname, relrowsecurity 
            FROM pg_class 
            WHERE relrowsecurity = true AND relkind = 'r';
        ''')
        rls_names = [t['relname'] for t in rls_tables]
        print(f" -> RLS enabled on tables: {', '.join(rls_names)}")

        # 3. Test Sweeper execution
        print("\n3. Testing batch sweeper execution...")
        await run_all_sweepers()
        print(" -> Sweeper executed cleanly!")

        print("\n[SUCCESS] Verification Successful: All Postgres performance optimizations are active and verified!")
    except Exception as e:
        print(f"\n[ERROR] Verification Error: {e}")
        raise e
    finally:
        await prisma.disconnect()

if __name__ == "__main__":
    asyncio.run(run_verification())

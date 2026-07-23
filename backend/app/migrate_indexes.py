import asyncio
from app.database import prisma

async def apply_indexes():
    print("Connecting to database...")
    await prisma.connect()
    try:
        print("Applying SQL Indexes (HNSW Vector & GIN JSONB)...")
        
        # 1. HNSW Vector Index on Resume.embedding
        await prisma.execute_raw('''
            CREATE INDEX IF NOT EXISTS idx_resume_embedding_hnsw 
            ON "Resume" USING hnsw (embedding vector_cosine_ops);
        ''')
        print(" -> Created HNSW index on Resume(embedding)")

        # 2. HNSW Vector Index on Campaign.jdEmbedding
        await prisma.execute_raw('''
            CREATE INDEX IF NOT EXISTS idx_campaign_jdembedding_hnsw 
            ON "Campaign" USING hnsw ("jdEmbedding" vector_cosine_ops);
        ''')
        print(" -> Created HNSW index on Campaign(jdEmbedding)")

        # 3. GIN Index on Resume.structuredProfile
        await prisma.execute_raw('''
            CREATE INDEX IF NOT EXISTS idx_resume_structured_profile_gin 
            ON "Resume" USING gin ("structuredProfile" jsonb_path_ops);
        ''')
        print(" -> Created GIN index on Resume(structuredProfile)")

        # 4. Standard FK & Filter Indexes
        await prisma.execute_raw('CREATE INDEX IF NOT EXISTS idx_campaign_user_id ON "Campaign" ("userId");')
        await prisma.execute_raw('CREATE INDEX IF NOT EXISTS idx_candidate_campaign_id ON "Candidate" ("campaignId");')
        await prisma.execute_raw('CREATE INDEX IF NOT EXISTS idx_candidate_resume_id ON "Candidate" ("resumeId");')
        await prisma.execute_raw('CREATE INDEX IF NOT EXISTS idx_candidate_campaign_status ON "Candidate" ("campaignId", "status");')
        await prisma.execute_raw('CREATE INDEX IF NOT EXISTS idx_candidate_created_at ON "Candidate" ("createdAt");')
        await prisma.execute_raw('CREATE INDEX IF NOT EXISTS idx_candidate_updated_at ON "Candidate" ("updatedAt");')
        await prisma.execute_raw('CREATE INDEX IF NOT EXISTS idx_candidate_analytics_campaign_id ON "CandidateAnalytics" ("campaignId");')
        print(" -> Created FK & filter indexes on Campaign, Candidate, and CandidateAnalytics")

        print("Index migration successfully completed!")
    except Exception as e:
        print(f"Error applying index migration: {e}")
    finally:
        await prisma.disconnect()

if __name__ == "__main__":
    asyncio.run(apply_indexes())

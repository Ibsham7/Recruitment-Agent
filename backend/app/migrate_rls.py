import asyncio
from app.database import prisma

async def apply_rls():
    print("Connecting to database for RLS policy deployment...")
    await prisma.connect()
    try:
        tables = ["Campaign", "Candidate", "Resume", "Evaluation", "CandidateAnalytics"]
        for table in tables:
            await prisma.execute_raw(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY;')
            print(f" -> RLS enabled on table {table}")

        # Drop existing policies if any to ensure idempotency
        await prisma.execute_raw('DROP POLICY IF EXISTS campaign_owner_policy ON "Campaign";')
        await prisma.execute_raw('DROP POLICY IF EXISTS candidate_owner_policy ON "Candidate";')
        await prisma.execute_raw('DROP POLICY IF EXISTS evaluation_owner_policy ON "Evaluation";')

        # Create campaign user-isolation policy using cached subquery (SELECT auth.uid())
        await prisma.execute_raw('''
            CREATE POLICY campaign_owner_policy ON "Campaign"
            FOR ALL
            TO authenticated, service_role
            USING (
                "userId" IS NULL 
                OR "userId" = (SELECT auth.uid())::text 
                OR current_setting('role', true) = 'service_role'
            );
        ''')
        print(" -> Created RLS policy campaign_owner_policy on Campaign")

        # Create candidate policy tied to campaign ownership
        await prisma.execute_raw('''
            CREATE POLICY candidate_owner_policy ON "Candidate"
            FOR ALL
            TO authenticated, service_role
            USING (
                EXISTS (
                    SELECT 1 FROM "Campaign" c
                    WHERE c.id = "Candidate"."campaignId"
                      AND (c."userId" IS NULL OR c."userId" = (SELECT auth.uid())::text)
                )
                OR current_setting('role', true) = 'service_role'
            );
        ''')
        print(" -> Created RLS policy candidate_owner_policy on Candidate")

        print("RLS policy migration completed successfully!")
    except Exception as e:
        print(f"Error applying RLS policies: {e}")
    finally:
        await prisma.disconnect()

if __name__ == "__main__":
    asyncio.run(apply_rls())

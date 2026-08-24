import os
import sys
import uuid
import unittest
from dotenv import load_dotenv
from fastapi import HTTPException

# Ensure backend root is in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

load_dotenv(os.path.join(backend_dir, ".env"))

from app.database import prisma
from app.services import billing_service


class TestM4SetupQuotaCalculationChallenger(unittest.IsolatedAsyncioTestCase):
    """
    Adversarial and empirical verification suite for M4 setup quota calculation:
    1. Cost = 1 + N CVs.
    2. Free account: 5 campaigns limit check and 100 CVs limit check.
    3. Paid account: balance sufficiency check (creditBalance >= 1 + N).
    4. Edge cases & exact boundary validations.
    """

    async def asyncSetUp(self):
        if not prisma.is_connected():
            await prisma.connect()
        self.cleanup_user_ids = []

    async def asyncTearDown(self):
        for uid in self.cleanup_user_ids:
            try:
                await prisma.userprofile.delete(where={"userId": uid})
            except Exception:
                pass
        if prisma.is_connected():
            await prisma.disconnect()

    def make_user_id(self, prefix: str = "m4_challenger") -> str:
        uid = f"{prefix}_{uuid.uuid4().hex[:10]}"
        self.cleanup_user_ids.append(uid)
        return uid

    # =========================================================================
    # 1. SETUP QUOTA COST FORMULA: Cost = 1 + N CVs
    # =========================================================================

    async def test_setup_cost_calculation_formula(self):
        """
        Verify that campaign setup cost strictly follows Cost = 1 + N CVs.
        Tests various values of N: 0, 1, 5, 10, 25, 100.
        """
        test_cases = [
            (0, 1),    # 1 base + 0 CVs = 1 credit
            (1, 2),    # 1 base + 1 CV = 2 credits
            (5, 6),    # 1 base + 5 CVs = 6 credits
            (10, 11),  # 1 base + 10 CVs = 11 credits
            (25, 26),  # 1 base + 25 CVs = 26 credits
            (100, 101) # 1 base + 100 CVs = 101 credits
        ]

        for num_cvs, expected_cost in test_cases:
            uid = self.make_user_id(f"cost_n{num_cvs}")
            email = f"{uid}@example.com"
            starting_balance = expected_cost + 50

            # Provision paid profile with sufficient credits
            await prisma.userprofile.create(
                data={
                    "userId": uid,
                    "email": email,
                    "plan": "paid",
                    "creditBalance": starting_balance
                }
            )

            # Perform campaign creation deduction
            camp_id = f"camp_{num_cvs}_{uuid.uuid4().hex[:6]}"
            updated = await billing_service.validate_and_deduct_campaign_creation(
                user_id=uid,
                email=email,
                num_resumes=num_cvs,
                campaign_title=f"Campaign with {num_cvs} CVs",
                campaign_id=camp_id
            )

            # Assert exact deduction
            self.assertEqual(
                updated.creditBalance,
                starting_balance - expected_cost,
                f"For N={num_cvs} CVs, expected cost {expected_cost} deducted from {starting_balance} to yield {starting_balance - expected_cost}, got {updated.creditBalance}"
            )

            # Verify transaction ledger entries
            txs = await prisma.credittransaction.find_many(
                where={"userId": uid, "relatedEntityId": camp_id},
                order={"createdAt": "asc"}
            )
            self.assertEqual(len(txs), 2)
            # Base campaign transaction
            self.assertEqual(txs[0].type, "debit_campaign")
            self.assertEqual(txs[0].credits, -1)
            # CV processing transaction
            self.assertEqual(txs[1].type, "debit_cv")
            self.assertEqual(txs[1].credits, -num_cvs)

    # =========================================================================
    # 2. FREE ACCOUNT LIMIT CHECKS (5 Campaigns & 100 CVs)
    # =========================================================================

    async def test_free_account_5_campaigns_limit(self):
        """
        Empirically verify 5 campaigns limit for free tier:
        - 1st to 5th campaigns are permitted.
        - 6th campaign is rejected with HTTP 402 and specific error detail.
        """
        uid = self.make_user_id("free_5camp")
        email = f"{uid}@example.com"

        # Start with fresh profile
        profile = await billing_service.get_or_create_user_profile(uid, email)
        self.assertEqual(profile.plan, "free")
        self.assertEqual(profile.totalCampaignsCreated, 0)

        # Create campaigns 1 through 5 (1 CV each, total CVs = 5 <= 100)
        for i in range(1, 6):
            res = await billing_service.validate_and_deduct_campaign_creation(
                user_id=uid,
                email=email,
                num_resumes=1,
                campaign_title=f"Free Campaign {i}",
                campaign_id=f"free_camp_{i}"
            )
            self.assertEqual(res.totalCampaignsCreated, i)
            self.assertEqual(res.totalCvsProcessed, i)

        # 6th campaign attempt MUST fail with HTTP 402
        with self.assertRaises(HTTPException) as ctx:
            await billing_service.validate_and_deduct_campaign_creation(
                user_id=uid,
                email=email,
                num_resumes=1,
                campaign_title="Free Campaign 6 (Over Limit)",
                campaign_id="free_camp_6"
            )
        self.assertEqual(ctx.exception.status_code, 402)
        self.assertIn("Free plan limit exceeded: maximum 5 campaigns allowed", ctx.exception.detail)
        self.assertIn("(current: 5)", ctx.exception.detail)

        # Verify DB was NOT mutated on rejected attempt
        db_profile = await prisma.userprofile.find_unique(where={"userId": uid})
        self.assertEqual(db_profile.totalCampaignsCreated, 5)
        self.assertEqual(db_profile.totalCvsProcessed, 5)

    async def test_free_account_100_cvs_limit(self):
        """
        Empirically verify 100 CVs limit for free tier:
        - Exact boundary: 100 CVs total allowed.
        - Exceeding boundary by even 1 CV (e.g. 95 + 6 = 101) fails with HTTP 402.
        - Immediate 101 CV upload on fresh profile fails with HTTP 402.
        """
        # Scenario A: Fresh profile attempts 101 CVs in 1 campaign
        uid_a = self.make_user_id("free_101cv")
        email_a = f"{uid_a}@example.com"
        await billing_service.get_or_create_user_profile(uid_a, email_a)

        with self.assertRaises(HTTPException) as ctx_a:
            await billing_service.validate_and_deduct_campaign_creation(
                user_id=uid_a,
                email=email_a,
                num_resumes=101,
                campaign_title="Over 100 CVs",
                campaign_id="camp_101"
            )
        self.assertEqual(ctx_a.exception.status_code, 402)
        self.assertIn("Free plan limit exceeded: maximum 100 CV uploads allowed", ctx_a.exception.detail)

        # Scenario B: Profile at 95 CVs uploads 5 CVs -> reaches exactly 100 (Success)
        uid_b = self.make_user_id("free_95cv")
        email_b = f"{uid_b}@example.com"
        await prisma.userprofile.create(
            data={
                "userId": uid_b,
                "email": email_b,
                "plan": "free",
                "totalCampaignsCreated": 2,
                "totalCvsProcessed": 95
            }
        )

        res_b = await billing_service.validate_and_deduct_campaign_creation(
            user_id=uid_b,
            email=email_b,
            num_resumes=5,
            campaign_title="Top up to 100 CVs",
            campaign_id="camp_topup"
        )
        self.assertEqual(res_b.totalCampaignsCreated, 3)
        self.assertEqual(res_b.totalCvsProcessed, 100)

        # Subsequent upload of even 1 CV fails
        with self.assertRaises(HTTPException) as ctx_b:
            await billing_service.validate_and_deduct_campaign_creation(
                user_id=uid_b,
                email=email_b,
                num_resumes=1,
                campaign_title="1 CV over limit",
                campaign_id="camp_over"
            )
        self.assertEqual(ctx_b.exception.status_code, 402)
        self.assertIn("Free plan limit exceeded: maximum 100 CV uploads allowed (current: 100, requested: 1)", ctx_b.exception.detail)

    # =========================================================================
    # 3. PAID ACCOUNT BALANCE SUFFICIENCY CHECKS (creditBalance >= 1 + N)
    # =========================================================================

    async def test_paid_account_exact_balance_sufficiency(self):
        """
        Verify exact balance sufficiency:
        - If creditBalance == 1 + N: succeeds and balance becomes exactly 0.
        - If creditBalance == (1 + N) - 1: fails with HTTP 402.
        """
        # Exact match: N = 9, required = 10, balance = 10
        uid = self.make_user_id("paid_exact")
        email = f"{uid}@example.com"
        await prisma.userprofile.create(
            data={
                "userId": uid,
                "email": email,
                "plan": "paid",
                "creditBalance": 10
            }
        )

        res = await billing_service.validate_and_deduct_campaign_creation(
            user_id=uid,
            email=email,
            num_resumes=9,
            campaign_title="Exact Match Campaign",
            campaign_id="camp_exact"
        )
        self.assertEqual(res.creditBalance, 0)
        self.assertEqual(res.totalCampaignsCreated, 1)
        self.assertEqual(res.totalCvsProcessed, 9)

        # Now balance is 0: next attempt with N=0 (cost 1) must fail
        with self.assertRaises(HTTPException) as ctx:
            await billing_service.validate_and_deduct_campaign_creation(
                user_id=uid,
                email=email,
                num_resumes=0,
                campaign_title="Zero Balance Attempt",
                campaign_id="camp_zero"
            )
        self.assertEqual(ctx.exception.status_code, 402)
        self.assertIn("Insufficient credit balance. Required: 1 credits (1 for campaign + 0 for CVs), available: 0 credits", ctx.exception.detail)

    async def test_paid_account_off_by_one_insufficiency(self):
        """
        Verify that having 1 credit less than required (1 + N) triggers 402.
        """
        uid = self.make_user_id("paid_off_by_one")
        email = f"{uid}@example.com"
        num_resumes = 20
        required = 1 + num_resumes # 21 credits

        await prisma.userprofile.create(
            data={
                "userId": uid,
                "email": email,
                "plan": "paid",
                "creditBalance": 20 # 1 less than 21
            }
        )

        with self.assertRaises(HTTPException) as ctx:
            await billing_service.validate_and_deduct_campaign_creation(
                user_id=uid,
                email=email,
                num_resumes=num_resumes,
                campaign_title="Off by one",
                campaign_id="camp_off1"
            )
        self.assertEqual(ctx.exception.status_code, 402)
        self.assertIn("Insufficient credit balance. Required: 21 credits", ctx.exception.detail)
        self.assertIn("available: 20 credits", ctx.exception.detail)

    async def test_paid_account_surpasses_free_limits(self):
        """
        Verify that paid accounts are NOT constrained by the free limits
        (can create > 5 campaigns and process > 100 CVs as long as creditBalance >= 1 + N).
        """
        uid = self.make_user_id("paid_power_user")
        email = f"{uid}@example.com"

        # Paid user with 1000 credits, already created 10 campaigns and 500 CVs
        await prisma.userprofile.create(
            data={
                "userId": uid,
                "email": email,
                "plan": "paid",
                "creditBalance": 1000,
                "totalCampaignsCreated": 10,
                "totalCvsProcessed": 500
            }
        )

        # Process a single campaign with 150 CVs (cost = 151)
        res = await billing_service.validate_and_deduct_campaign_creation(
            user_id=uid,
            email=email,
            num_resumes=150,
            campaign_title="Mega Campaign",
            campaign_id="camp_mega"
        )
        self.assertEqual(res.creditBalance, 1000 - 151) # 849
        self.assertEqual(res.totalCampaignsCreated, 11)
        self.assertEqual(res.totalCvsProcessed, 650)


if __name__ == "__main__":
    unittest.main()

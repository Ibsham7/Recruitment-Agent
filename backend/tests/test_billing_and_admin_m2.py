import os
import sys
import uuid
import asyncio
import unittest
from datetime import datetime, timezone
from dotenv import load_dotenv
from fastapi import HTTPException

# Ensure backend root is in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

load_dotenv(os.path.join(backend_dir, ".env"))

from app.database import prisma
from app.services import billing_service
from app.services.r2_service import generate_presigned_payment_screenshot_url
from app.security import is_admin_email, is_admin_user, require_admin


class TestBillingAndAdminMilestone2(unittest.IsolatedAsyncioTestCase):
    """
    Comprehensive verification suite for Milestone 2:
    - Auto-provisioning
    - Free tier quota boundaries (campaigns, CVs, invitations)
    - Paid tier eager debits (1/1/1/2 unit rubric)
    - Admin approval workflow ($1 = 100 credits, plan upgrade, purchase transaction)
    - Admin rejection & manual credit adjustments
    - System stats aggregation
    - R2 payment screenshot presigned URLs
    - Admin security guards
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

    def make_user_id(self, prefix: str = "m2_user") -> str:
        uid = f"{prefix}_{uuid.uuid4().hex[:10]}"
        self.cleanup_user_ids.append(uid)
        return uid

    # =========================================================================
    # 1. USER PROFILE AUTO-PROVISIONING
    # =========================================================================

    async def test_auto_provision_user_profile(self):
        uid = self.make_user_id("prov")
        email = f"{uid}@example.com"

        # 1. Fetch non-existent profile -> should auto-create with default Free tier
        profile = await billing_service.get_or_create_user_profile(uid, email)
        self.assertIsNotNone(profile)
        self.assertEqual(profile.userId, uid)
        self.assertEqual(profile.email, email)
        self.assertEqual(profile.plan, "free")
        self.assertEqual(profile.creditBalance, 0)
        self.assertEqual(profile.totalCampaignsCreated, 0)
        self.assertEqual(profile.totalCvsProcessed, 0)
        self.assertEqual(profile.totalInterviewsSent, 0)

        # 2. Idempotent second fetch returns same profile
        profile2 = await billing_service.get_or_create_user_profile(uid, email)
        self.assertEqual(profile2.id, profile.id)

    # =========================================================================
    # 2. FREE TIER LIFETIME LIMITS
    # =========================================================================

    async def test_free_tier_campaign_and_cv_limits(self):
        uid = self.make_user_id("free_camp")
        email = f"{uid}@example.com"

        # Create profile with 4 campaigns, 95 CVs
        await prisma.userprofile.create(
            data={
                "userId": uid,
                "email": email,
                "plan": "free",
                "totalCampaignsCreated": 4,
                "totalCvsProcessed": 95
            }
        )

        # 1. 5th campaign with 5 CVs -> totalCampaigns=5, totalCvs=100 (exact boundary) -> succeeds
        res = await billing_service.validate_and_deduct_campaign_creation(
            user_id=uid,
            email=email,
            num_resumes=5,
            campaign_title="5th Campaign",
            campaign_id="camp_5"
        )
        self.assertEqual(res.totalCampaignsCreated, 5)
        self.assertEqual(res.totalCvsProcessed, 100)

        # 2. 6th campaign creation attempt -> should fail with 402
        with self.assertRaises(HTTPException) as ctx:
            await billing_service.validate_and_deduct_campaign_creation(
                user_id=uid,
                email=email,
                num_resumes=1,
                campaign_title="6th Campaign",
                campaign_id="camp_6"
            )
        self.assertEqual(ctx.exception.status_code, 402)
        self.assertIn("maximum 5 campaigns allowed", ctx.exception.detail)

    async def test_free_tier_cv_upload_limit_exceeded(self):
        uid = self.make_user_id("free_cv")
        email = f"{uid}@example.com"

        # Create profile with 0 campaigns, 90 CVs
        await prisma.userprofile.create(
            data={
                "userId": uid,
                "email": email,
                "plan": "free",
                "totalCampaignsCreated": 1,
                "totalCvsProcessed": 90
            }
        )

        # Attempting to upload 15 CVs (90 + 15 = 105 > 100) -> fails with 402
        with self.assertRaises(HTTPException) as ctx:
            await billing_service.validate_and_deduct_campaign_creation(
                user_id=uid,
                email=email,
                num_resumes=15,
                campaign_title="Bulk CV Campaign",
                campaign_id="camp_bulk"
            )
        self.assertEqual(ctx.exception.status_code, 402)
        self.assertIn("maximum 100 CV uploads allowed", ctx.exception.detail)

    async def test_free_tier_interview_invitations_limit(self):
        uid = self.make_user_id("free_inv")
        email = f"{uid}@example.com"

        await prisma.userprofile.create(
            data={
                "userId": uid,
                "email": email,
                "plan": "free",
                "totalInterviewsSent": 3
            }
        )

        # 1. Send 2 invites -> total = 5 (allowed)
        p = await billing_service.validate_and_deduct_interview_invitations(uid, email, 2)
        self.assertEqual(p.totalInterviewsSent, 5)

        # 2. Attempt to send 1 more invite -> 5 + 1 = 6 > 5 -> fails with 402
        with self.assertRaises(HTTPException) as ctx:
            await billing_service.validate_and_deduct_interview_invitations(uid, email, 1)
        self.assertEqual(ctx.exception.status_code, 402)
        self.assertIn("maximum 5 interview invitations allowed", ctx.exception.detail)

    # =========================================================================
    # 3. PAID TIER CREDIT DEDUCTIONS & 1/1/1/2 UNIT RUBRIC
    # =========================================================================

    async def test_paid_tier_campaign_and_cv_deduction(self):
        uid = self.make_user_id("paid_camp")
        email = f"{uid}@example.com"

        # Paid user with 100 credits
        await prisma.userprofile.create(
            data={
                "userId": uid,
                "email": email,
                "plan": "paid",
                "creditBalance": 100
            }
        )

        # Create campaign with 10 CVs -> Cost: 1 (campaign) + 10 (CVs) = 11 credits
        updated = await billing_service.validate_and_deduct_campaign_creation(
            user_id=uid,
            email=email,
            num_resumes=10,
            campaign_title="Senior Engineer",
            campaign_id="camp_se_10"
        )
        self.assertEqual(updated.creditBalance, 89)
        self.assertEqual(updated.totalCampaignsCreated, 1)
        self.assertEqual(updated.totalCvsProcessed, 10)

        # Verify 2 transactions logged: debit_campaign (-1) and debit_cv (-10)
        txs = await prisma.credittransaction.find_many(
            where={"userId": uid},
            order={"createdAt": "asc"}
        )
        self.assertEqual(len(txs), 2)
        self.assertEqual(txs[0].type, "debit_campaign")
        self.assertEqual(txs[0].credits, -1)
        self.assertEqual(txs[0].relatedEntityId, "camp_se_10")
        self.assertEqual(txs[1].type, "debit_cv")
        self.assertEqual(txs[1].credits, -10)
        self.assertEqual(txs[1].relatedEntityId, "camp_se_10")

    async def test_paid_tier_insufficient_credits_campaign(self):
        uid = self.make_user_id("paid_low_bal")
        email = f"{uid}@example.com"

        # Paid user with only 5 credits
        await prisma.userprofile.create(
            data={
                "userId": uid,
                "email": email,
                "plan": "paid",
                "creditBalance": 5
            }
        )

        # Attempt to create campaign with 10 CVs (requires 11 credits) -> fails with 402
        with self.assertRaises(HTTPException) as ctx:
            await billing_service.validate_and_deduct_campaign_creation(
                user_id=uid,
                email=email,
                num_resumes=10,
                campaign_title="Too Expensive",
                campaign_id="camp_expensive"
            )
        self.assertEqual(ctx.exception.status_code, 402)
        self.assertIn("Insufficient credit balance", ctx.exception.detail)

    async def test_paid_tier_interview_invitation_deduction(self):
        uid = self.make_user_id("paid_inv")
        email = f"{uid}@example.com"

        await prisma.userprofile.create(
            data={
                "userId": uid,
                "email": email,
                "plan": "paid",
                "creditBalance": 50
            }
        )

        # Send 5 interview invitations (1 credit each -> 5 credits)
        updated = await billing_service.validate_and_deduct_interview_invitations(uid, email, 5)
        self.assertEqual(updated.creditBalance, 45)
        self.assertEqual(updated.totalInterviewsSent, 5)

        txs = await prisma.credittransaction.find_many(where={"userId": uid, "type": "debit_invite"})
        self.assertEqual(len(txs), 1)
        self.assertEqual(txs[0].credits, -5)

    async def test_paid_tier_evaluation_deduction(self):
        uid = self.make_user_id("paid_eval")
        email = f"{uid}@example.com"

        await prisma.userprofile.create(
            data={
                "userId": uid,
                "email": email,
                "plan": "paid",
                "creditBalance": 50
            }
        )

        # Deduct 2 evaluation credits upon candidate evaluation
        updated = await billing_service.deduct_evaluation_credits(
            user_id=uid,
            candidate_id="cand_123",
            candidate_name="Alice Smith"
        )
        self.assertIsNotNone(updated)
        self.assertEqual(updated.creditBalance, 48)

        txs = await prisma.credittransaction.find_many(where={"userId": uid, "type": "debit_evaluation"})
        self.assertEqual(len(txs), 1)
        self.assertEqual(txs[0].credits, -2)
        self.assertEqual(txs[0].relatedEntityId, "cand_123")
        self.assertIn("Alice Smith", txs[0].description)

    # =========================================================================
    # 4. ADMIN WORKFLOWS: APPROVE, REJECT, ADJUST, STATS
    # =========================================================================

    async def test_admin_approve_credit_request_allocates_100_credits_per_dollar(self):
        uid = self.make_user_id("req_approve")
        email = f"{uid}@example.com"

        await prisma.userprofile.create(
            data={
                "userId": uid,
                "email": email,
                "plan": "free",
                "creditBalance": 0
            }
        )

        # Submit $10 credit request
        req = await prisma.creditrequest.create(
            data={
                "userId": uid,
                "amount": 10.0,
                "screenshotUrl": "https://r2.example.com/payment-screenshots/proof.png",
                "status": "pending"
            }
        )

        # Admin approves request
        res = await billing_service.approve_credit_request(req.id, "admin@recruitment.com")
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["creditsAllocated"], 1000)  # $10 * 100 = 1000 credits
        self.assertEqual(res["newBalance"], 1000)

        # Verify user profile upgraded to 'paid' with balance = 1000
        user = await prisma.userprofile.find_unique(where={"userId": uid})
        self.assertEqual(user.plan, "paid")
        self.assertEqual(user.creditBalance, 1000)

        # Verify request status updated
        updated_req = await prisma.creditrequest.find_unique(where={"id": req.id})
        self.assertEqual(updated_req.status, "approved")
        self.assertEqual(updated_req.creditsAllocated, 1000)
        self.assertEqual(updated_req.reviewedBy, "admin@recruitment.com")
        self.assertIsNotNone(updated_req.reviewedAt)

        # Verify purchase transaction logged
        txs = await prisma.credittransaction.find_many(where={"userId": uid, "type": "purchase"})
        self.assertEqual(len(txs), 1)
        self.assertEqual(txs[0].credits, 1000)
        self.assertEqual(txs[0].relatedEntityId, req.id)

    async def test_admin_reject_credit_request(self):
        uid = self.make_user_id("req_reject")
        email = f"{uid}@example.com"

        await prisma.userprofile.create(data={"userId": uid, "email": email})
        req = await prisma.creditrequest.create(
            data={
                "userId": uid,
                "amount": 25.0,
                "screenshotUrl": "https://r2.example.com/blurry.png",
                "status": "pending"
            }
        )

        res = await billing_service.reject_credit_request(req.id, "admin@recruitment.com", "Blurry receipt")
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["rejectionReason"], "Blurry receipt")

        updated_req = await prisma.creditrequest.find_unique(where={"id": req.id})
        self.assertEqual(updated_req.status, "rejected")
        self.assertEqual(updated_req.rejectionReason, "Blurry receipt")
        self.assertEqual(updated_req.reviewedBy, "admin@recruitment.com")
        self.assertIsNotNone(updated_req.reviewedAt)

    async def test_admin_adjust_user_credits(self):
        uid = self.make_user_id("req_adjust")
        email = f"{uid}@example.com"

        await prisma.userprofile.create(
            data={"userId": uid, "email": email, "plan": "free", "creditBalance": 50}
        )

        # Admin grants +200 bonus credits and sets plan to 'paid'
        res = await billing_service.adjust_user_credits(
            user_id=uid,
            adjustment=200,
            reason="Special promotional bonus",
            plan="paid"
        )
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["newBalance"], 250)
        self.assertEqual(res["plan"], "paid")

        user = await prisma.userprofile.find_unique(where={"userId": uid})
        self.assertEqual(user.creditBalance, 250)
        self.assertEqual(user.plan, "paid")

        # Verify admin_adjustment transaction logged
        txs = await prisma.credittransaction.find_many(where={"userId": uid, "type": "admin_adjustment"})
        self.assertEqual(len(txs), 1)
        self.assertEqual(txs[0].credits, 200)
        self.assertEqual(txs[0].description, "Special promotional bonus")

    async def test_admin_system_stats(self):
        stats = await billing_service.get_admin_stats()
        self.assertIn("totalUsers", stats)
        self.assertIn("planBreakdown", stats)
        self.assertIn("free", stats["planBreakdown"])
        self.assertIn("paid", stats["planBreakdown"])
        self.assertIn("totalCvsProcessed", stats)
        self.assertIn("totalCampaignsCreated", stats)
        self.assertIn("totalInterviewsSent", stats)
        self.assertIn("totalCreditsAllocated", stats)
        self.assertIn("totalRevenue", stats)
        self.assertIn("pendingRequestsCount", stats)

    # =========================================================================
    # 5. R2 PAYMENT PRESIGNED URL GENERATION
    # =========================================================================

    def test_payment_presigned_url_generation(self):
        uid = "test_user_r2_pay"
        res = generate_presigned_payment_screenshot_url(
            user_id=uid,
            filename="receipt proof.png",
            content_type="image/png"
        )
        self.assertIn("uploadUrl", res)
        self.assertIn("fileUrl", res)
        self.assertIn("objectKey", res)
        self.assertTrue(res["objectKey"].startswith(f"payment-screenshots/{uid}/"))
        self.assertTrue(res["objectKey"].endswith("_receipt_proof.png"))
        self.assertIn(res["objectKey"], res["fileUrl"])

    # =========================================================================
    # 6. ADMIN SECURITY GUARDS
    # =========================================================================

    def test_admin_email_verification(self):
        os.environ["ADMIN_EMAILS"] = "admin@example.com, superuser@agentichr.dev"
        self.assertTrue(is_admin_email("admin@example.com"))
        self.assertTrue(is_admin_email("SUPERUSER@agentichr.dev"))
        self.assertFalse(is_admin_email("regular_user@example.com"))
        self.assertFalse(is_admin_email(""))
        self.assertFalse(is_admin_email(None))

        # Test is_admin_user with dict
        self.assertTrue(is_admin_user({"email": "admin@example.com"}))
        self.assertFalse(is_admin_user({"email": "hacker@evil.com"}))
        self.assertTrue(is_admin_user({"user_metadata": {"email": "superuser@agentichr.dev"}}))


if __name__ == "__main__":
    unittest.main()

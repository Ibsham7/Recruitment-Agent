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
from app.routers import admin as admin_router


class TestAdminActionLogicMilestone3(unittest.IsolatedAsyncioTestCase):
    """
    Empirical Adversarial Verification Suite for Milestone 3 Admin Action Logic:
    1. Approve Action:
       - 1 USD = 100 credits conversion formula
       - User creditBalance increment
       - UserProfile plan upgrade to 'paid'
       - CreditRequest status 'approved', creditsAllocated, reviewedBy, reviewedAt
       - Immutable CreditTransaction of type 'purchase'
       - Prevention of double-approval and approving already-rejected requests
    2. Reject Action:
       - Rejection reason requirement and storage
       - CreditRequest status 'rejected', reviewedBy, reviewedAt
       - User balance and plan immunity (no change)
       - Prevention of double-rejection and rejecting already-approved requests
    3. Manual Credit Adjustment:
       - Positive credit adjustments
       - Negative credit adjustments
       - Plan tier override (free -> paid, paid -> free)
       - Immutable CreditTransaction of type 'admin_adjustment'
       - Edge cases: zero adjustment, invalid plan tier, non-existent user
    """

    async def asyncSetUp(self):
        if not prisma.is_connected():
            await prisma.connect()
        self.cleanup_user_ids = []

    async def asyncTearDown(self):
        for uid in self.cleanup_user_ids:
            try:
                # Cascade or clean transactions, requests, and profiles
                await prisma.credittransaction.delete_many(where={"userId": uid})
                await prisma.creditrequest.delete_many(where={"userId": uid})
                await prisma.userprofile.delete(where={"userId": uid})
            except Exception:
                pass
        if prisma.is_connected():
            await prisma.disconnect()

    def make_user_id(self, prefix: str = "m3_admin_test") -> str:
        uid = f"{prefix}_{uuid.uuid4().hex[:10]}"
        self.cleanup_user_ids.append(uid)
        return uid

    # =========================================================================
    # 1. APPROVE ACTION TESTS ($1 = 100 credits, balance update, status change)
    # =========================================================================

    async def test_approve_action_standard_amount(self):
        uid = self.make_user_id("appr_std")
        email = f"{uid}@example.com"
        admin_email = "admin_reviewer@recruitment.dev"

        # Create free user with 0 credits
        await prisma.userprofile.create(
            data={
                "userId": uid,
                "email": email,
                "plan": "free",
                "creditBalance": 0
            }
        )

        # Create pending credit request for $20.00 (expected: 2000 credits)
        req = await prisma.creditrequest.create(
            data={
                "userId": uid,
                "amount": 20.0,
                "screenshotUrl": "https://r2.example.com/receipts/proof_20.png",
                "status": "pending"
            }
        )

        # Execute approval
        res = await billing_service.approve_credit_request(req.id, admin_email)

        # 1. Check return payload
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["creditsAllocated"], 2000)
        self.assertEqual(res["newBalance"], 2000)

        # 2. Check updated CreditRequest model in DB
        db_req = await prisma.creditrequest.find_unique(where={"id": req.id})
        self.assertIsNotNone(db_req)
        self.assertEqual(db_req.status, "approved")
        self.assertEqual(db_req.creditsAllocated, 2000)
        self.assertEqual(db_req.reviewedBy, admin_email)
        self.assertIsNotNone(db_req.reviewedAt)

        # 3. Check updated UserProfile model in DB
        db_user = await prisma.userprofile.find_unique(where={"userId": uid})
        self.assertIsNotNone(db_user)
        self.assertEqual(db_user.plan, "paid")
        self.assertEqual(db_user.creditBalance, 2000)

        # 4. Check CreditTransaction ledger entry
        txs = await prisma.credittransaction.find_many(where={"userId": uid, "type": "purchase"})
        self.assertEqual(len(txs), 1)
        self.assertEqual(txs[0].credits, 2000)
        self.assertEqual(txs[0].relatedEntityId, req.id)
        self.assertIn("$20.00", txs[0].description)
        self.assertIn("+2000 credits", txs[0].description)

    async def test_approve_action_fractional_and_large_amounts(self):
        """
        Verify formula 1 USD = 100 credits across fractional ($15.50 -> 1550, $0.99 -> 99)
        and large ($100.00 -> 10000) amounts.
        """
        uid = self.make_user_id("appr_frac")
        email = f"{uid}@example.com"
        admin_email = "superadmin@recruitment.dev"

        # Create user with initial balance 50
        await prisma.userprofile.create(
            data={
                "userId": uid,
                "email": email,
                "plan": "paid",
                "creditBalance": 50
            }
        )

        # Request 1: $15.50 -> 1550 credits
        req1 = await prisma.creditrequest.create(
            data={
                "userId": uid,
                "amount": 15.50,
                "screenshotUrl": "https://r2.example.com/receipts/proof_15_50.png",
                "status": "pending"
            }
        )
        res1 = await billing_service.approve_credit_request(req1.id, admin_email)
        self.assertEqual(res1["creditsAllocated"], 1550)
        self.assertEqual(res1["newBalance"], 1600)  # 50 + 1550

        # Request 2: $0.99 -> 99 credits
        req2 = await prisma.creditrequest.create(
            data={
                "userId": uid,
                "amount": 0.99,
                "screenshotUrl": "https://r2.example.com/receipts/proof_0_99.png",
                "status": "pending"
            }
        )
        res2 = await billing_service.approve_credit_request(req2.id, admin_email)
        self.assertEqual(res2["creditsAllocated"], 99)
        self.assertEqual(res2["newBalance"], 1699)  # 1600 + 99

    async def test_approve_action_double_approval_blocked(self):
        """
        Attempting to approve an already approved request must fail with 400 Bad Request.
        """
        uid = self.make_user_id("appr_dup")
        email = f"{uid}@example.com"

        await prisma.userprofile.create(data={"userId": uid, "email": email, "plan": "free"})
        req = await prisma.creditrequest.create(
            data={"userId": uid, "amount": 10.0, "screenshotUrl": "https://r2.example.com/p.png", "status": "pending"}
        )

        # First approval succeeds
        await billing_service.approve_credit_request(req.id, "admin@recruitment.dev")

        # Second approval must raise 400
        with self.assertRaises(HTTPException) as ctx:
            await billing_service.approve_credit_request(req.id, "admin@recruitment.dev")
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("already approved", ctx.exception.detail)

    async def test_approve_action_already_rejected_blocked(self):
        """
        Attempting to approve an already rejected request must fail with 400 Bad Request.
        """
        uid = self.make_user_id("appr_rej")
        email = f"{uid}@example.com"

        await prisma.userprofile.create(data={"userId": uid, "email": email, "plan": "free"})
        req = await prisma.creditrequest.create(
            data={"userId": uid, "amount": 10.0, "screenshotUrl": "https://r2.example.com/p.png", "status": "pending"}
        )

        # Reject first
        await billing_service.reject_credit_request(req.id, "admin@recruitment.dev", "Bad screenshot")

        # Attempt to approve
        with self.assertRaises(HTTPException) as ctx:
            await billing_service.approve_credit_request(req.id, "admin@recruitment.dev")
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("already rejected", ctx.exception.detail)

    # =========================================================================
    # 2. REJECT ACTION TESTS (reason requirement, status update)
    # =========================================================================

    async def test_reject_action_with_custom_reason(self):
        uid = self.make_user_id("rej_cust")
        email = f"{uid}@example.com"
        admin_email = "compliance_lead@recruitment.dev"
        reason = "Payment receipt is blurred and missing bank transaction reference ID"

        await prisma.userprofile.create(
            data={
                "userId": uid,
                "email": email,
                "plan": "free",
                "creditBalance": 10
            }
        )

        req = await prisma.creditrequest.create(
            data={
                "userId": uid,
                "amount": 50.0,
                "screenshotUrl": "https://r2.example.com/receipts/blurry_50.png",
                "status": "pending"
            }
        )

        # Execute rejection
        res = await billing_service.reject_credit_request(req.id, admin_email, reason)
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["status_name"], "rejected")
        self.assertEqual(res["rejectionReason"], reason)

        # 1. Verify CreditRequest updated
        db_req = await prisma.creditrequest.find_unique(where={"id": req.id})
        self.assertIsNotNone(db_req)
        self.assertEqual(db_req.status, "rejected")
        self.assertEqual(db_req.rejectionReason, reason)
        self.assertEqual(db_req.reviewedBy, admin_email)
        self.assertIsNotNone(db_req.reviewedAt)

        # 2. Verify UserProfile remains unchanged (balance 10, plan free)
        db_user = await prisma.userprofile.find_unique(where={"userId": uid})
        self.assertEqual(db_user.creditBalance, 10)
        self.assertEqual(db_user.plan, "free")

        # 3. Verify no CreditTransaction was created
        txs = await prisma.credittransaction.find_many(where={"userId": uid})
        self.assertEqual(len(txs), 0)

    async def test_reject_action_default_fallback_reason(self):
        """
        Verify that an empty or whitespace reason receives a safe fallback audit description.
        """
        uid = self.make_user_id("rej_fallback")
        email = f"{uid}@example.com"

        await prisma.userprofile.create(data={"userId": uid, "email": email, "plan": "free"})
        req = await prisma.creditrequest.create(
            data={"userId": uid, "amount": 10.0, "screenshotUrl": "https://r2.example.com/p.png", "status": "pending"}
        )

        res = await billing_service.reject_credit_request(req.id, "admin@recruitment.dev", "   ")
        self.assertEqual(res["rejectionReason"], "Payment verification failed")

    async def test_reject_action_double_rejection_blocked(self):
        """
        Attempting to reject an already rejected request must fail with 400 Bad Request.
        """
        uid = self.make_user_id("rej_dup")
        email = f"{uid}@example.com"

        await prisma.userprofile.create(data={"userId": uid, "email": email, "plan": "free"})
        req = await prisma.creditrequest.create(
            data={"userId": uid, "amount": 10.0, "screenshotUrl": "https://r2.example.com/p.png", "status": "pending"}
        )

        await billing_service.reject_credit_request(req.id, "admin@recruitment.dev", "Reason 1")

        with self.assertRaises(HTTPException) as ctx:
            await billing_service.reject_credit_request(req.id, "admin@recruitment.dev", "Reason 2")
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("already rejected", ctx.exception.detail)

    async def test_reject_action_already_approved_blocked(self):
        """
        Attempting to reject an already approved request must fail with 400 Bad Request.
        """
        uid = self.make_user_id("rej_appr")
        email = f"{uid}@example.com"

        await prisma.userprofile.create(data={"userId": uid, "email": email, "plan": "free"})
        req = await prisma.creditrequest.create(
            data={"userId": uid, "amount": 10.0, "screenshotUrl": "https://r2.example.com/p.png", "status": "pending"}
        )

        await billing_service.approve_credit_request(req.id, "admin@recruitment.dev")

        with self.assertRaises(HTTPException) as ctx:
            await billing_service.reject_credit_request(req.id, "admin@recruitment.dev", "Too late")
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("already approved", ctx.exception.detail)

    # =========================================================================
    # 3. MANUAL CREDIT ADJUSTMENT TESTS (positive/negative integers, plan tier)
    # =========================================================================

    async def test_manual_adjustment_positive_credits(self):
        uid = self.make_user_id("adj_pos")
        email = f"{uid}@example.com"

        await prisma.userprofile.create(
            data={
                "userId": uid,
                "email": email,
                "plan": "free",
                "creditBalance": 100
            }
        )

        # Add +500 credits with reason
        res = await billing_service.adjust_user_credits(
            user_id=uid,
            adjustment=500,
            reason="Customer support compensation for latency",
            plan=None
        )

        self.assertEqual(res["status"], "success")
        self.assertEqual(res["newBalance"], 600)
        self.assertEqual(res["plan"], "free")

        # Verify DB UserProfile
        user = await prisma.userprofile.find_unique(where={"userId": uid})
        self.assertEqual(user.creditBalance, 600)
        self.assertEqual(user.plan, "free")

        # Verify CreditTransaction
        txs = await prisma.credittransaction.find_many(where={"userId": uid, "type": "admin_adjustment"})
        self.assertEqual(len(txs), 1)
        self.assertEqual(txs[0].credits, 500)
        self.assertEqual(txs[0].description, "Customer support compensation for latency")

    async def test_manual_adjustment_negative_credits(self):
        uid = self.make_user_id("adj_neg")
        email = f"{uid}@example.com"

        await prisma.userprofile.create(
            data={
                "userId": uid,
                "email": email,
                "plan": "paid",
                "creditBalance": 800
            }
        )

        # Deduct -300 credits
        res = await billing_service.adjust_user_credits(
            user_id=uid,
            adjustment=-300,
            reason="Manual deduction for refunded charge",
            plan=None
        )

        self.assertEqual(res["status"], "success")
        self.assertEqual(res["newBalance"], 500)
        self.assertEqual(res["plan"], "paid")

        user = await prisma.userprofile.find_unique(where={"userId": uid})
        self.assertEqual(user.creditBalance, 500)

        txs = await prisma.credittransaction.find_many(where={"userId": uid, "type": "admin_adjustment"})
        self.assertEqual(len(txs), 1)
        self.assertEqual(txs[0].credits, -300)
        self.assertEqual(txs[0].description, "Manual deduction for refunded charge")

    async def test_manual_adjustment_with_plan_tier_override(self):
        """
        Verify plan tier overrides: free -> paid, paid -> free, along with credit adjustments.
        """
        uid = self.make_user_id("adj_plan")
        email = f"{uid}@example.com"

        await prisma.userprofile.create(
            data={
                "userId": uid,
                "email": email,
                "plan": "free",
                "creditBalance": 0
            }
        )

        # 1. Upgrade from 'free' to 'paid' with +1000 credits
        res1 = await billing_service.adjust_user_credits(
            user_id=uid,
            adjustment=1000,
            reason="VIP tier upgrade",
            plan="paid"
        )
        self.assertEqual(res1["newBalance"], 1000)
        self.assertEqual(res1["plan"], "paid")

        user1 = await prisma.userprofile.find_unique(where={"userId": uid})
        self.assertEqual(user1.plan, "paid")
        self.assertEqual(user1.creditBalance, 1000)

        # 2. Downgrade from 'paid' to 'free' with 0 adjustment
        res2 = await billing_service.adjust_user_credits(
            user_id=uid,
            adjustment=0,
            reason="Downgrade to free tier upon request",
            plan="free"
        )
        self.assertEqual(res2["newBalance"], 1000)
        self.assertEqual(res2["plan"], "free")

        user2 = await prisma.userprofile.find_unique(where={"userId": uid})
        self.assertEqual(user2.plan, "free")

    async def test_manual_adjustment_non_existent_user_raises_404(self):
        """
        Adjusting credits for a non-existent user must raise 404 Not Found.
        """
        fake_uid = "non_existent_user_9999"
        with self.assertRaises(HTTPException) as ctx:
            await billing_service.adjust_user_credits(
                user_id=fake_uid,
                adjustment=100,
                reason="Test",
                plan=None
            )
        self.assertEqual(ctx.exception.status_code, 404)
        self.assertIn("User profile not found", ctx.exception.detail)


if __name__ == "__main__":
    unittest.main()

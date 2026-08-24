import os
import sys
import uuid
import asyncio
import unittest
import httpx
from datetime import datetime, timezone
from dotenv import load_dotenv
from fastapi import HTTPException

# Ensure backend root is in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

load_dotenv(os.path.join(backend_dir, ".env"))

from app.database import prisma
from app.main import app
from app.services import billing_service
from app.services.r2_service import (
    generate_presigned_payment_screenshot_url,
    generate_presigned_upload_url,
    extract_object_key_from_url
)
from app.security import is_admin_email, is_admin_user, require_admin, verify_jwt


class TestAdversarialBillingM2(unittest.IsolatedAsyncioTestCase):
    """
    Adversarial and Stress Challenge Suite for Milestone 2:
    1. Free user strict quota boundary conditions & attempt-to-exceed stress
    2. Paid user balance starvation & 1/1/1/2 unit rubric precision
    3. Non-admin unauthorized access to all 6 admin endpoints & spoofing defenses
    4. Admin approval conversion accuracy, plan upgrades, and transaction audit trails
    5. Duplicate approval & duplicate rejection state transitions
    6. Presigned URL path traversal, special characters, and sanitization
    """

    async def asyncSetUp(self):
        if not prisma.is_connected():
            await prisma.connect()
        self.cleanup_user_ids = []
        self.transport = httpx.ASGITransport(app=app)
        self.client = httpx.AsyncClient(transport=self.transport, base_url="http://testserver")

    async def asyncTearDown(self):
        await self.client.aclose()
        for uid in self.cleanup_user_ids:
            try:
                await prisma.userprofile.delete(where={"userId": uid})
            except Exception:
                pass
        app.dependency_overrides.clear()
        if prisma.is_connected():
            await prisma.disconnect()

    def make_user_id(self, prefix: str = "adv_user") -> str:
        uid = f"{prefix}_{uuid.uuid4().hex[:12]}"
        self.cleanup_user_ids.append(uid)
        return uid

    def override_auth(self, user_id: str, email: str, is_admin: bool = False):
        user_payload = {
            "sub": user_id,
            "id": user_id,
            "email": email,
            "user_metadata": {"email": email}
        }
        app.dependency_overrides[verify_jwt] = lambda: user_payload
        if is_admin:
            app.dependency_overrides[require_admin] = lambda: user_payload

    # =========================================================================
    # 1. FREE USER LIMITS: 5 CAMPAIGNS, 100 CVS, 5 INVITES & EXCEED STRESS
    # =========================================================================

    async def test_free_user_campaign_limit_exact_and_exceeded(self):
        uid = self.make_user_id("adv_free_camp")
        email = f"{uid}@test.local"

        profile = await billing_service.get_or_create_user_profile(uid, email)
        self.assertEqual(profile.plan, "free")

        # Create 5 campaigns sequentially (each with 0 CVs)
        for i in range(1, 6):
            res = await billing_service.validate_and_deduct_campaign_creation(
                user_id=uid,
                email=email,
                num_resumes=0,
                campaign_title=f"Campaign #{i}",
                campaign_id=f"c_{i}"
            )
            self.assertEqual(res.totalCampaignsCreated, i)

        # 6th campaign must be rejected with HTTP 402
        with self.assertRaises(HTTPException) as ctx:
            await billing_service.validate_and_deduct_campaign_creation(
                user_id=uid,
                email=email,
                num_resumes=0,
                campaign_title="Campaign #6",
                campaign_id="c_6"
            )
        self.assertEqual(ctx.exception.status_code, 402)
        self.assertIn("maximum 5 campaigns allowed", ctx.exception.detail)

        # Verify state did not mutate beyond 5
        check = await prisma.userprofile.find_unique(where={"userId": uid})
        self.assertEqual(check.totalCampaignsCreated, 5)

    async def test_free_user_cv_limit_exact_and_exceeded(self):
        uid = self.make_user_id("adv_free_cv")
        email = f"{uid}@test.local"

        await billing_service.get_or_create_user_profile(uid, email)

        # 1st campaign uploads 70 CVs (70 <= 100) -> OK
        p1 = await billing_service.validate_and_deduct_campaign_creation(
            user_id=uid, email=email, num_resumes=70, campaign_title="C1", campaign_id="c1"
        )
        self.assertEqual(p1.totalCvsProcessed, 70)

        # 2nd campaign uploads 30 CVs (70 + 30 = 100 <= 100) -> OK
        p2 = await billing_service.validate_and_deduct_campaign_creation(
            user_id=uid, email=email, num_resumes=30, campaign_title="C2", campaign_id="c2"
        )
        self.assertEqual(p2.totalCvsProcessed, 100)

        # 3rd campaign attempts 1 CV (100 + 1 = 101 > 100) -> must fail with HTTP 402
        with self.assertRaises(HTTPException) as ctx:
            await billing_service.validate_and_deduct_campaign_creation(
                user_id=uid, email=email, num_resumes=1, campaign_title="C3", campaign_id="c3"
            )
        self.assertEqual(ctx.exception.status_code, 402)
        self.assertIn("maximum 100 CV uploads allowed", ctx.exception.detail)

        # Ensure campaign count was not incremented when CV validation failed
        check = await prisma.userprofile.find_unique(where={"userId": uid})
        self.assertEqual(check.totalCampaignsCreated, 2)
        self.assertEqual(check.totalCvsProcessed, 100)

    async def test_free_user_single_campaign_exceeding_100_cvs(self):
        uid = self.make_user_id("adv_free_mega")
        email = f"{uid}@test.local"

        await billing_service.get_or_create_user_profile(uid, email)

        # Single campaign with 101 CVs right away
        with self.assertRaises(HTTPException) as ctx:
            await billing_service.validate_and_deduct_campaign_creation(
                user_id=uid, email=email, num_resumes=101, campaign_title="Mega", campaign_id="c_mega"
            )
        self.assertEqual(ctx.exception.status_code, 402)
        self.assertIn("maximum 100 CV uploads allowed", ctx.exception.detail)

    async def test_free_user_interview_invites_exact_and_exceeded(self):
        uid = self.make_user_id("adv_free_inv")
        email = f"{uid}@test.local"

        await billing_service.get_or_create_user_profile(uid, email)

        # Send 3 invites
        p1 = await billing_service.validate_and_deduct_interview_invitations(uid, email, 3)
        self.assertEqual(p1.totalInterviewsSent, 3)

        # Send 2 invites (total = 5) -> OK
        p2 = await billing_service.validate_and_deduct_interview_invitations(uid, email, 2)
        self.assertEqual(p2.totalInterviewsSent, 5)

        # Attempt to send 1 more invite (5 + 1 = 6 > 5) -> fail 402
        with self.assertRaises(HTTPException) as ctx:
            await billing_service.validate_and_deduct_interview_invitations(uid, email, 1)
        self.assertEqual(ctx.exception.status_code, 402)
        self.assertIn("maximum 5 interview invitations allowed", ctx.exception.detail)

        # Attempt to send 0 invites -> idempotent no-op returns profile
        p3 = await billing_service.validate_and_deduct_interview_invitations(uid, email, 0)
        self.assertEqual(p3.totalInterviewsSent, 5)

    # =========================================================================
    # 2. PAID USER INSUFFICIENT BALANCE & 1/1/1/2 UNIT RUBRIC
    # =========================================================================

    async def test_paid_user_zero_balance_rejection(self):
        uid = self.make_user_id("adv_paid_zero")
        email = f"{uid}@test.local"

        await prisma.userprofile.create(
            data={"userId": uid, "email": email, "plan": "paid", "creditBalance": 0}
        )

        # 1. Campaign creation (1 credit required) -> 402
        with self.assertRaises(HTTPException) as ctx1:
            await billing_service.validate_and_deduct_campaign_creation(
                user_id=uid, email=email, num_resumes=0, campaign_title="Zero Bal", campaign_id="cz"
            )
        self.assertEqual(ctx1.exception.status_code, 402)
        self.assertIn("Insufficient credit balance", ctx1.exception.detail)

        # 2. Invite dispatch (1 credit required) -> 402
        with self.assertRaises(HTTPException) as ctx2:
            await billing_service.validate_and_deduct_interview_invitations(uid, email, 1)
        self.assertEqual(ctx2.exception.status_code, 402)
        self.assertIn("Insufficient credit balance", ctx2.exception.detail)

    async def test_paid_user_insufficient_cv_credits(self):
        uid = self.make_user_id("adv_paid_partial")
        email = f"{uid}@test.local"

        # User has 10 credits
        await prisma.userprofile.create(
            data={"userId": uid, "email": email, "plan": "paid", "creditBalance": 10}
        )

        # Attempts campaign with 10 CVs (Cost = 1 + 10 = 11 credits > 10) -> 402
        with self.assertRaises(HTTPException) as ctx:
            await billing_service.validate_and_deduct_campaign_creation(
                user_id=uid, email=email, num_resumes=10, campaign_title="Needs 11", campaign_id="c11"
            )
        self.assertEqual(ctx.exception.status_code, 402)
        self.assertIn("Required: 11 credits", ctx.exception.detail)

        # Balance remains unmodified at 10
        check = await prisma.userprofile.find_unique(where={"userId": uid})
        self.assertEqual(check.creditBalance, 10)

        # Now create campaign with 9 CVs (Cost = 1 + 9 = 10 credits == 10) -> succeeds!
        updated = await billing_service.validate_and_deduct_campaign_creation(
            user_id=uid, email=email, num_resumes=9, campaign_title="Exact 10", campaign_id="c10"
        )
        self.assertEqual(updated.creditBalance, 0)
        self.assertEqual(updated.totalCampaignsCreated, 1)
        self.assertEqual(updated.totalCvsProcessed, 9)

    async def test_paid_user_evaluation_rubric_2_credits(self):
        uid = self.make_user_id("adv_eval_rubric")
        email = f"{uid}@test.local"

        await prisma.userprofile.create(
            data={"userId": uid, "email": email, "plan": "paid", "creditBalance": 20}
        )

        # Deduct 2 evaluation credits
        res = await billing_service.deduct_evaluation_credits(
            user_id=uid,
            candidate_id="cand_adv_1",
            candidate_name="Bob Test"
        )
        self.assertIsNotNone(res)
        self.assertEqual(res.creditBalance, 18)

        tx = await prisma.credittransaction.find_first(
            where={"userId": uid, "type": "debit_evaluation"}
        )
        self.assertIsNotNone(tx)
        self.assertEqual(tx.credits, -2)
        self.assertEqual(tx.relatedEntityId, "cand_adv_1")

        # Free tier user should NOT be deducted on evaluation
        free_uid = self.make_user_id("adv_eval_free")
        await prisma.userprofile.create(
            data={"userId": free_uid, "email": f"{free_uid}@test.local", "plan": "free", "creditBalance": 0}
        )
        free_res = await billing_service.deduct_evaluation_credits(
            user_id=free_uid, candidate_id="cand_free", candidate_name="Free Candidate"
        )
        self.assertEqual(free_res.creditBalance, 0)
        free_txs = await prisma.credittransaction.find_many(where={"userId": free_uid})
        self.assertEqual(len(free_txs), 0)

    # =========================================================================
    # 3. NON-ADMIN ATTEMPTING ALL 6 ADMIN ENDPOINTS
    # =========================================================================

    async def test_non_admin_blocked_on_all_6_admin_endpoints(self):
        attacker_uid = self.make_user_id("attacker")
        attacker_email = f"attacker_{attacker_uid}@evil.local"
        os.environ["ADMIN_EMAILS"] = "legit_admin@system.com"

        # Mock non-admin JWT
        self.override_auth(attacker_uid, attacker_email, is_admin=False)

        dummy_req_id = str(uuid.uuid4())
        dummy_user_id = str(uuid.uuid4())

        # 1. GET /api/admin/users
        r1 = await self.client.get("/api/admin/users")
        self.assertEqual(r1.status_code, 403, f"r1: {r1.text}")

        # 2. GET /api/admin/credit-requests
        r2 = await self.client.get("/api/admin/credit-requests")
        self.assertEqual(r2.status_code, 403, f"r2: {r2.text}")

        # 3. POST /api/admin/credit-requests/{id}/approve
        r3 = await self.client.post(f"/api/admin/credit-requests/{dummy_req_id}/approve")
        self.assertEqual(r3.status_code, 403, f"r3: {r3.text}")

        # 4. POST /api/admin/credit-requests/{id}/reject
        r4 = await self.client.post(f"/api/admin/credit-requests/{dummy_req_id}/reject", json={"reason": "Hacked"})
        self.assertEqual(r4.status_code, 403, f"r4: {r4.text}")

        # 5. PATCH /api/admin/users/{userId}/credits
        r5 = await self.client.patch(f"/api/admin/users/{dummy_user_id}/credits", json={"adjustment": 10000})
        self.assertEqual(r5.status_code, 403, f"r5: {r5.text}")

        # 6. GET /api/admin/stats
        r6 = await self.client.get("/api/admin/stats")
        self.assertEqual(r6.status_code, 403, f"r6: {r6.text}")

    async def test_admin_email_spoofing_attempts(self):
        os.environ["ADMIN_EMAILS"] = "admin@system.com, root@agentichr.dev"

        # Subdomain / prefix attack
        self.assertFalse(is_admin_email("admin@system.com.evil.com"))
        self.assertFalse(is_admin_email("fakeadmin@system.com"))
        self.assertFalse(is_admin_email("admin@system.co"))
        self.assertFalse(is_admin_email("notroot@agentichr.dev"))
        self.assertFalse(is_admin_email("root@agentichr.dev.attacker.com"))

        # Whitespace and case tolerance
        self.assertTrue(is_admin_email("  admin@system.com  "))
        self.assertTrue(is_admin_email("ADMIN@SYSTEM.COM"))
        self.assertTrue(is_admin_email("RoOt@AgEnTiChR.dEv"))

        # Empty / None / invalid types
        self.assertFalse(is_admin_email(""))
        self.assertFalse(is_admin_email("   "))
        self.assertFalse(is_admin_email(None))

    # =========================================================================
    # 4. ADMIN APPROVAL $10 -> 1000 CREDITS, UPGRADE, AND TRANSACTION LOGGING
    # =========================================================================

    async def test_admin_approval_dollar_to_credit_math_and_audit(self):
        target_uid = self.make_user_id("target_math")
        target_email = f"{target_uid}@example.com"

        # Initial state: Free plan, 0 credits
        await prisma.userprofile.create(
            data={"userId": target_uid, "email": target_email, "plan": "free", "creditBalance": 0}
        )

        # Create $10 request
        req10 = await prisma.creditrequest.create(
            data={
                "userId": target_uid,
                "amount": 10.0,
                "screenshotUrl": "https://r2.test/proof10.png",
                "status": "pending"
            }
        )

        res = await billing_service.approve_credit_request(req10.id, "admin@system.com")
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["creditsAllocated"], 1000)
        self.assertEqual(res["newBalance"], 1000)

        # Verify UserProfile upgraded to 'paid'
        p = await prisma.userprofile.find_unique(where={"userId": target_uid})
        self.assertEqual(p.plan, "paid")
        self.assertEqual(p.creditBalance, 1000)

        # Verify transaction logged
        tx = await prisma.credittransaction.find_first(
            where={"userId": target_uid, "relatedEntityId": req10.id}
        )
        self.assertIsNotNone(tx)
        self.assertEqual(tx.type, "purchase")
        self.assertEqual(tx.credits, 1000)
        self.assertIn("$10.00", tx.description)

        # Test fractional amount: $15.50 -> 1550 credits
        req15 = await prisma.creditrequest.create(
            data={
                "userId": target_uid,
                "amount": 15.50,
                "screenshotUrl": "https://r2.test/proof15.png",
                "status": "pending"
            }
        )
        res15 = await billing_service.approve_credit_request(req15.id, "admin@system.com")
        self.assertEqual(res15["creditsAllocated"], 1550)
        self.assertEqual(res15["newBalance"], 2550)  # 1000 + 1550 = 2550

        p15 = await prisma.userprofile.find_unique(where={"userId": target_uid})
        self.assertEqual(p15.creditBalance, 2550)

    # =========================================================================
    # 5. DUPLICATE APPROVAL & DUPLICATE REJECTION INTEGRITY
    # =========================================================================

    async def test_duplicate_approval_rejection_state_machine(self):
        uid = self.make_user_id("adv_state_mach")
        email = f"{uid}@test.local"

        await prisma.userprofile.create(
            data={"userId": uid, "email": email, "plan": "free", "creditBalance": 0}
        )

        req = await prisma.creditrequest.create(
            data={
                "userId": uid,
                "amount": 5.0,
                "screenshotUrl": "https://r2.test/5.png",
                "status": "pending"
            }
        )

        # 1. First approval -> succeeds (500 credits allocated)
        r1 = await billing_service.approve_credit_request(req.id, "admin@system.com")
        self.assertEqual(r1["creditsAllocated"], 500)

        # 2. Second approval on same request -> MUST FAIL with 400
        with self.assertRaises(HTTPException) as ctx_app:
            await billing_service.approve_credit_request(req.id, "admin@system.com")
        self.assertEqual(ctx_app.exception.status_code, 400)
        self.assertIn("already approved", ctx_app.exception.detail)

        # 3. Rejecting an already approved request -> MUST FAIL with 400
        with self.assertRaises(HTTPException) as ctx_rej:
            await billing_service.reject_credit_request(req.id, "admin@system.com", "Changed mind")
        self.assertEqual(ctx_rej.exception.status_code, 400)
        self.assertIn("already approved", ctx_rej.exception.detail)

        # Verify user was only credited once (+500, not +1000)
        u = await prisma.userprofile.find_unique(where={"userId": uid})
        self.assertEqual(u.creditBalance, 500)

        # 4. Create another request and reject it
        req2 = await prisma.creditrequest.create(
            data={
                "userId": uid,
                "amount": 10.0,
                "screenshotUrl": "https://r2.test/bad.png",
                "status": "pending"
            }
        )
        r2 = await billing_service.reject_credit_request(req2.id, "admin@system.com", "Invalid receipt")
        self.assertEqual(r2["status"], "success")

        # 5. Rejecting again -> MUST FAIL with 400
        with self.assertRaises(HTTPException) as ctx_rej2:
            await billing_service.reject_credit_request(req2.id, "admin@system.com", "Reject again")
        self.assertEqual(ctx_rej2.exception.status_code, 400)
        self.assertIn("already rejected", ctx_rej2.exception.detail)

        # 6. Approving an already rejected request -> MUST FAIL with 400
        with self.assertRaises(HTTPException) as ctx_app2:
            await billing_service.approve_credit_request(req2.id, "admin@system.com")
        self.assertEqual(ctx_app2.exception.status_code, 400)
        self.assertIn("already rejected", ctx_app2.exception.detail)

    # =========================================================================
    # 6. PATH TRAVERSAL & MALICIOUS CHARACTERS IN PRESIGNED URLS
    # =========================================================================

    def test_payment_presigned_url_path_traversal_and_malicious_inputs(self):
        uid = "adv_r2_user"

        adversarial_filenames = [
            "../../etc/passwd",
            "..\\..\\windows\\system32\\cmd.exe",
            "../../../secret.png",
            "<script>alert(1)</script>.png",
            "'; DROP TABLE \"UserProfile\"; --.png",
            "receipt with spaces & special %20 symbols.png",
            "a" * 300 + ".png",  # very long filename
        ]

        for fname in adversarial_filenames:
            res = generate_presigned_payment_screenshot_url(
                user_id=uid,
                filename=fname,
                content_type="image/png"
            )
            self.assertIn("uploadUrl", res)
            self.assertIn("fileUrl", res)
            self.assertIn("objectKey", res)
            # Must strictly reside under payment-screenshots/{uid}/
            self.assertTrue(res["objectKey"].startswith(f"payment-screenshots/{uid}/"))

    def test_presigned_url_missing_user_id_raises_value_error(self):
        with self.assertRaises(ValueError):
            generate_presigned_payment_screenshot_url(user_id="", filename="receipt.png")
        with self.assertRaises(ValueError):
            generate_presigned_payment_screenshot_url(user_id=None, filename="receipt.png")

    def test_url_object_key_extraction_and_safe_fallback(self):
        public_base = os.getenv("R2_PUBLIC_URL", "https://pub-r2.agentichr.dev").rstrip("/")
        sample_key = "payment-screenshots/user123/uuid_receipt.png"
        sample_url = f"{public_base}/{sample_key}"

        extracted = extract_object_key_from_url(sample_url)
        self.assertEqual(extracted, sample_key)

        # None / invalid url
        self.assertIsNone(extract_object_key_from_url(None))
        self.assertIsNone(extract_object_key_from_url(""))


if __name__ == "__main__":
    unittest.main()

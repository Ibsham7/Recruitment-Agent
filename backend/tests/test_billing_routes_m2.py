import os
import sys
import uuid
import asyncio
import unittest
import httpx
from dotenv import load_dotenv

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

load_dotenv(os.path.join(backend_dir, ".env"))

from app.database import prisma
from app.main import app
from app.security import verify_jwt, require_admin


class TestBillingRoutesMilestone2(unittest.IsolatedAsyncioTestCase):
    """
    HTTP API Route Integration tests for user and admin billing endpoints
    using async HTTP transport.
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

    def make_user_id(self, prefix: str = "api_user") -> str:
        uid = f"{prefix}_{uuid.uuid4().hex[:10]}"
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

    async def test_get_user_profile_endpoint(self):
        uid = self.make_user_id("route_prof")
        email = f"{uid}@example.com"
        self.override_auth(uid, email, is_admin=False)

        response = await self.client.get("/api/user/profile")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("profile", data)
        self.assertIn("isAdmin", data)
        self.assertEqual(data["profile"]["userId"], uid)
        self.assertEqual(data["profile"]["plan"], "free")
        self.assertEqual(data["profile"]["creditBalance"], 0)
        self.assertEqual(data["isAdmin"], False)

    async def test_payment_presigned_url_endpoint(self):
        uid = self.make_user_id("route_r2")
        email = f"{uid}@example.com"
        self.override_auth(uid, email)

        response = await self.client.get("/api/upload/payment-screenshot-presigned-url?filename=receipt.png&contentType=image/png")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("uploadUrl", data)
        self.assertIn("fileUrl", data)
        self.assertIn("objectKey", data)
        self.assertTrue(data["objectKey"].startswith(f"payment-screenshots/{uid}/"))

    async def test_user_credit_request_submission_and_listing(self):
        uid = self.make_user_id("route_req")
        email = f"{uid}@example.com"
        self.override_auth(uid, email)

        # 1. Submit credit request
        post_res = await self.client.post(
            "/api/user/credit-requests",
            json={"amount": 15.0, "screenshotUrl": "https://r2.test/receipt.png"}
        )
        self.assertEqual(post_res.status_code, 200)
        req_data = post_res.json()
        self.assertEqual(req_data["amount"], 15.0)
        self.assertEqual(req_data["status"], "pending")
        req_id = req_data["id"]

        # 2. List user credit requests
        get_res = await self.client.get("/api/user/credit-requests")
        self.assertEqual(get_res.status_code, 200)
        reqs = get_res.json()
        self.assertGreaterEqual(len(reqs), 1)
        self.assertEqual(reqs[0]["id"], req_id)

    async def test_user_transactions_listing(self):
        uid = self.make_user_id("route_tx")
        email = f"{uid}@example.com"
        self.override_auth(uid, email)

        # Create profile and sample transaction
        await prisma.userprofile.create(data={"userId": uid, "email": email})
        await prisma.credittransaction.create(
            data={"userId": uid, "type": "purchase", "credits": 500, "description": "Test purchase"}
        )

        response = await self.client.get("/api/user/transactions")
        self.assertEqual(response.status_code, 200)
        txs = response.json()
        self.assertEqual(len(txs), 1)
        self.assertEqual(txs[0]["type"], "purchase")
        self.assertEqual(txs[0]["credits"], 500)

    async def test_admin_endpoints_authorization_guard(self):
        uid = self.make_user_id("non_admin")
        email = f"{uid}@regular.com"
        os.environ["ADMIN_EMAILS"] = "admin@system.com"

        user_payload = {"sub": uid, "id": uid, "email": email}
        app.dependency_overrides[verify_jwt] = lambda: user_payload

        response = await self.client.get("/api/admin/users")
        self.assertEqual(response.status_code, 403)
        self.assertIn("Admin privileges required", response.json()["detail"])

    async def test_admin_flow_approve_and_stats(self):
        admin_uid = self.make_user_id("admin_flow")
        admin_email = f"admin_{admin_uid}@system.com"
        os.environ["ADMIN_EMAILS"] = admin_email
        self.override_auth(admin_uid, admin_email, is_admin=True)

        # Target user submits $20 request
        target_uid = self.make_user_id("target_user")
        target_email = f"{target_uid}@example.com"
        await prisma.userprofile.create(data={"userId": target_uid, "email": target_email, "plan": "free"})
        req = await prisma.creditrequest.create(
            data={"userId": target_uid, "amount": 20.0, "screenshotUrl": "https://r2.test/20.png", "status": "pending"}
        )

        # 1. Admin lists credit requests
        list_res = await self.client.get("/api/admin/credit-requests?status=pending")
        self.assertEqual(list_res.status_code, 200)
        req_list = list_res.json()
        self.assertTrue(any(r["id"] == req.id for r in req_list))

        # 2. Admin approves request ($20 -> 2,000 credits)
        approve_res = await self.client.post(f"/api/admin/credit-requests/{req.id}/approve")
        self.assertEqual(approve_res.status_code, 200)
        approve_data = approve_res.json()
        self.assertEqual(approve_data["status"], "success")
        self.assertEqual(approve_data["creditsAllocated"], 2000)
        self.assertEqual(approve_data["newBalance"], 2000)

        # 3. Admin adjusts target user's credits (+50 credits)
        adj_res = await self.client.patch(
            f"/api/admin/users/{target_uid}/credits",
            json={"adjustment": 50, "reason": "Good customer bonus"}
        )
        self.assertEqual(adj_res.status_code, 200)
        self.assertEqual(adj_res.json()["newBalance"], 2050)

        # 4. Admin queries stats
        stats_res = await self.client.get("/api/admin/stats")
        self.assertEqual(stats_res.status_code, 200)
        stats = stats_res.json()
        self.assertGreaterEqual(stats["totalUsers"], 2)
        self.assertGreaterEqual(stats["totalCreditsAllocated"], 2000)
        self.assertGreaterEqual(stats["totalRevenue"], 20.0)


if __name__ == "__main__":
    unittest.main()

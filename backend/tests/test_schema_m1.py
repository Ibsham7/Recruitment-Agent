import os
import sys
import uuid
import asyncio
import unittest
from datetime import datetime, timezone
from dotenv import load_dotenv

# Ensure backend root is in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

load_dotenv(os.path.join(backend_dir, ".env"))

from app.database import prisma
from prisma.models import UserProfile, CreditRequest, CreditTransaction
from prisma.errors import UniqueViolationError


class TestSchemaMilestone1(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        if not prisma.is_connected():
            await prisma.connect()

    async def asyncTearDown(self):
        if prisma.is_connected():
            await prisma.disconnect()

    async def test_user_profile_crud_and_defaults(self):
        test_user_id = f"test_user_{uuid.uuid4().hex[:12]}"
        test_email = f"{test_user_id}@example.com"

        # 1. Create UserProfile
        profile = await prisma.userprofile.create(
            data={
                "userId": test_user_id,
                "email": test_email,
            }
        )
        self.assertIsNotNone(profile.id)
        self.assertEqual(profile.userId, test_user_id)
        self.assertEqual(profile.email, test_email)
        self.assertEqual(profile.plan, "free")
        self.assertEqual(profile.creditBalance, 0)
        self.assertEqual(profile.totalCvsProcessed, 0)
        self.assertEqual(profile.totalCampaignsCreated, 0)
        self.assertEqual(profile.totalInterviewsSent, 0)
        self.assertIsNotNone(profile.createdAt)
        self.assertIsNotNone(profile.updatedAt)

        # 2. Update UserProfile counters & plan
        updated = await prisma.userprofile.update(
            where={"userId": test_user_id},
            data={
                "plan": "paid",
                "creditBalance": 500,
                "totalCvsProcessed": 12,
                "totalCampaignsCreated": 2,
                "totalInterviewsSent": 3,
            }
        )
        self.assertEqual(updated.plan, "paid")
        self.assertEqual(updated.creditBalance, 500)
        self.assertEqual(updated.totalCvsProcessed, 12)
        self.assertEqual(updated.totalCampaignsCreated, 2)
        self.assertEqual(updated.totalInterviewsSent, 3)

        # 3. Clean up
        await prisma.userprofile.delete(where={"userId": test_user_id})
        deleted = await prisma.userprofile.find_unique(where={"userId": test_user_id})
        self.assertIsNone(deleted)

    async def test_user_profile_unique_constraint(self):
        test_user_id = f"test_user_unique_{uuid.uuid4().hex[:12]}"
        test_email = f"{test_user_id}@example.com"

        # Create first profile
        await prisma.userprofile.create(
            data={
                "userId": test_user_id,
                "email": test_email,
            }
        )

        try:
            # Attempt to create duplicate profile with same userId
            with self.assertRaises(UniqueViolationError):
                await prisma.userprofile.create(
                    data={
                        "userId": test_user_id,
                        "email": f"other_{test_email}",
                    }
                )
        finally:
            await prisma.userprofile.delete(where={"userId": test_user_id})

    async def test_credit_request_and_transaction_relations(self):
        test_user_id = f"test_user_rel_{uuid.uuid4().hex[:12]}"
        test_email = f"{test_user_id}@example.com"

        # 1. Create UserProfile
        profile = await prisma.userprofile.create(
            data={
                "userId": test_user_id,
                "email": test_email,
                "plan": "paid",
                "creditBalance": 1000,
            }
        )

        # 2. Create CreditRequest
        credit_req = await prisma.creditrequest.create(
            data={
                "userId": test_user_id,
                "amount": 10.0,
                "screenshotUrl": "https://r2.storage.example.com/payment-screenshots/test.png",
                "status": "pending",
            }
        )
        self.assertIsNotNone(credit_req.id)
        self.assertEqual(credit_req.userId, test_user_id)
        self.assertEqual(credit_req.amount, 10.0)
        self.assertEqual(credit_req.status, "pending")
        self.assertEqual(credit_req.creditsAllocated, 0)
        self.assertIsNone(credit_req.rejectionReason)

        # 3. Update CreditRequest to approved
        now_dt = datetime.now(timezone.utc)
        updated_req = await prisma.creditrequest.update(
            where={"id": credit_req.id},
            data={
                "status": "approved",
                "creditsAllocated": 1000,
                "reviewedBy": "admin@example.com",
                "reviewedAt": now_dt,
            }
        )
        self.assertEqual(updated_req.status, "approved")
        self.assertEqual(updated_req.creditsAllocated, 1000)
        self.assertEqual(updated_req.reviewedBy, "admin@example.com")
        self.assertIsNotNone(updated_req.reviewedAt)

        # 4. Create all valid CreditTransaction types
        tx_types = [
            ("purchase", 1000, "Purchase approved"),
            ("debit_campaign", -1, "Campaign creation fee"),
            ("debit_cv", -5, "5 CVs processed"),
            ("debit_invite", -2, "2 interview invites"),
            ("debit_evaluation", -2, "Evaluation debit"),
            ("refund", 2, "Refund for failed parse"),
            ("admin_adjustment", 50, "Manual credit grant"),
        ]

        created_txs = []
        for tx_type, credits_val, desc in tx_types:
            tx = await prisma.credittransaction.create(
                data={
                    "userId": test_user_id,
                    "type": tx_type,
                    "credits": credits_val,
                    "description": desc,
                    "relatedEntityId": credit_req.id if tx_type == "purchase" else None,
                }
            )
            self.assertIsNotNone(tx.id)
            self.assertEqual(tx.userId, test_user_id)
            self.assertEqual(tx.type, tx_type)
            self.assertEqual(tx.credits, credits_val)
            created_txs.append(tx)

        # 5. Fetch UserProfile with relations included
        profile_with_relations = await prisma.userprofile.find_unique(
            where={"userId": test_user_id},
            include={
                "creditRequests": True,
                "creditTransactions": True,
            }
        )
        self.assertIsNotNone(profile_with_relations)
        self.assertEqual(len(profile_with_relations.creditRequests), 1)
        self.assertEqual(profile_with_relations.creditRequests[0].id, credit_req.id)
        self.assertEqual(len(profile_with_relations.creditTransactions), len(tx_types))

        # 6. Test filtered queries by indexed fields
        pending_requests = await prisma.creditrequest.find_many(
            where={"status": "approved", "userId": test_user_id}
        )
        self.assertEqual(len(pending_requests), 1)

        purchase_txs = await prisma.credittransaction.find_many(
            where={"type": "purchase", "userId": test_user_id}
        )
        self.assertEqual(len(purchase_txs), 1)

        # 7. Test Cascade Delete: Deleting user profile should cascade-delete requests and transactions
        await prisma.userprofile.delete(where={"userId": test_user_id})

        req_after_del = await prisma.creditrequest.find_unique(where={"id": credit_req.id})
        self.assertIsNone(req_after_del)

        for created_tx in created_txs:
            tx_after_del = await prisma.credittransaction.find_unique(where={"id": created_tx.id})
            self.assertIsNone(tx_after_del)


if __name__ == "__main__":
    unittest.main()

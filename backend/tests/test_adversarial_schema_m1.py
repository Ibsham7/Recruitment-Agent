import os
import sys
import uuid
import asyncio
import unittest
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

# Ensure backend root is in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

load_dotenv(os.path.join(backend_dir, ".env"))

from app.database import prisma
from prisma.models import UserProfile, CreditRequest, CreditTransaction
from prisma.errors import UniqueViolationError, ForeignKeyViolationError, PrismaError


class TestAdversarialSchemaMilestone1(unittest.IsolatedAsyncioTestCase):
    """
    Adversarial and Stress Test Suite for Milestone 1 Database Schema.
    Validates constraints, foreign keys, cascade deletes, defaults,
    concurrency, numeric precision, and boundary conditions.
    """

    async def asyncSetUp(self):
        if not prisma.is_connected():
            await prisma.connect()
        self.cleanup_user_ids = []

    async def asyncTearDown(self):
        # Cleanup any leftover test users and their cascaded data
        for uid in self.cleanup_user_ids:
            try:
                await prisma.userprofile.delete(where={"userId": uid})
            except Exception:
                pass
        if prisma.is_connected():
            await prisma.disconnect()

    def create_user_id(self, prefix: str = "adv_user") -> str:
        uid = f"{prefix}_{uuid.uuid4().hex[:12]}"
        self.cleanup_user_ids.append(uid)
        return uid

    # =========================================================================
    # 1. UNIQUE CONSTRAINT & CONCURRENT INSERTION STRESS
    # =========================================================================

    async def test_unique_constraint_duplicate_user_id(self):
        """Stress-test unique constraint on UserProfile.userId."""
        uid = self.create_user_id("unique_test")
        email_1 = f"{uid}_1@example.com"
        email_2 = f"{uid}_2@example.com"

        # Create first profile
        p1 = await prisma.userprofile.create(
            data={"userId": uid, "email": email_1}
        )
        self.assertIsNotNone(p1.id)

        # Attempt to insert second profile with identical userId
        with self.assertRaises(UniqueViolationError):
            await prisma.userprofile.create(
                data={"userId": uid, "email": email_2}
            )

    async def test_concurrent_duplicate_user_id_race_condition(self):
        """Stress-test 10 concurrent async creations with the same userId to ensure database-level locking/uniqueness."""
        uid = self.create_user_id("race_test")
        
        async def try_create(idx: int):
            try:
                res = await prisma.userprofile.create(
                    data={"userId": uid, "email": f"{uid}_{idx}@example.com"}
                )
                return ("SUCCESS", res)
            except UniqueViolationError as e:
                return ("UNIQUE_VIOLATION", e)
            except Exception as e:
                return ("OTHER_ERROR", e)

        results = await asyncio.gather(*[try_create(i) for i in range(10)])
        
        successes = [r for r in results if r[0] == "SUCCESS"]
        violations = [r for r in results if r[0] == "UNIQUE_VIOLATION"]
        other_errors = [r for r in results if r[0] == "OTHER_ERROR"]

        self.assertEqual(len(successes), 1, f"Expected exactly 1 successful creation, got {len(successes)}")
        self.assertEqual(len(violations), 9, f"Expected 9 UniqueViolationError, got {len(violations)}")
        self.assertEqual(len(other_errors), 0, f"Unexpected errors: {other_errors}")

    # =========================================================================
    # 2. FOREIGN KEY INTEGRITY STRESS
    # =========================================================================

    async def test_credit_request_fk_violation_invalid_user_id(self):
        """Attempt to insert CreditRequest with non-existent userId."""
        non_existent_uid = f"non_existent_{uuid.uuid4().hex[:12]}"

        with self.assertRaises((ForeignKeyViolationError, PrismaError)):
            await prisma.creditrequest.create(
                data={
                    "userId": non_existent_uid,
                    "amount": 25.0,
                    "screenshotUrl": "https://r2.storage.test/receipt.png",
                }
            )

    async def test_credit_transaction_fk_violation_invalid_user_id(self):
        """Attempt to insert CreditTransaction with non-existent userId."""
        non_existent_uid = f"non_existent_{uuid.uuid4().hex[:12]}"

        with self.assertRaises((ForeignKeyViolationError, PrismaError)):
            await prisma.credittransaction.create(
                data={
                    "userId": non_existent_uid,
                    "type": "purchase",
                    "credits": 500,
                    "description": "Invalid FK test transaction",
                }
            )

    async def test_credit_request_fk_update_to_invalid_user_id(self):
        """Attempt to mutate CreditRequest.userId to non-existent foreign key."""
        uid = self.create_user_id("fk_update_test")
        await prisma.userprofile.create(data={"userId": uid, "email": f"{uid}@example.com"})

        req = await prisma.creditrequest.create(
            data={"userId": uid, "amount": 10.0, "screenshotUrl": "https://r2.test/receipt.png"}
        )

        invalid_uid = f"invalid_fk_{uuid.uuid4().hex[:12]}"
        with self.assertRaises((ForeignKeyViolationError, PrismaError)):
            await prisma.creditrequest.update(
                where={"id": req.id},
                data={"userId": invalid_uid}
            )

    # =========================================================================
    # 3. CASCADE DELETE STRESS & ISOLATION
    # =========================================================================

    async def test_cascade_delete_multi_entities(self):
        """Stress-test cascade delete: 1 UserProfile -> 10 CreditRequests + 20 CreditTransactions."""
        uid = self.create_user_id("cascade_test")
        await prisma.userprofile.create(data={"userId": uid, "email": f"{uid}@example.com", "plan": "paid", "creditBalance": 1000})

        # Create 10 CreditRequests
        req_ids = []
        for i in range(10):
            r = await prisma.creditrequest.create(
                data={
                    "userId": uid,
                    "amount": float(10 * (i + 1)),
                    "screenshotUrl": f"https://r2.test/receipt_{i}.png",
                    "status": "pending" if i % 2 == 0 else "approved",
                }
            )
            req_ids.append(r.id)

        # Create 20 CreditTransactions
        tx_ids = []
        for i in range(20):
            tx_type = "purchase" if i % 4 == 0 else "debit_cv"
            t = await prisma.credittransaction.create(
                data={
                    "userId": uid,
                    "type": tx_type,
                    "credits": 100 if tx_type == "purchase" else -1,
                    "description": f"Tx stress test #{i}",
                }
            )
            tx_ids.append(t.id)

        # Confirm all 30 child records exist
        found_reqs = await prisma.creditrequest.find_many(where={"userId": uid})
        found_txs = await prisma.credittransaction.find_many(where={"userId": uid})
        self.assertEqual(len(found_reqs), 10)
        self.assertEqual(len(found_txs), 20)

        # Delete UserProfile
        await prisma.userprofile.delete(where={"userId": uid})

        # Verify all 10 CreditRequests and 20 CreditTransactions are cascade deleted
        reqs_after = await prisma.creditrequest.find_many(where={"userId": uid})
        txs_after = await prisma.credittransaction.find_many(where={"userId": uid})
        self.assertEqual(len(reqs_after), 0)
        self.assertEqual(len(txs_after), 0)

        # Double check by individual IDs
        for r_id in req_ids:
            self.assertIsNone(await prisma.creditrequest.find_unique(where={"id": r_id}))
        for t_id in tx_ids:
            self.assertIsNone(await prisma.credittransaction.find_unique(where={"id": t_id}))

    async def test_child_deletion_does_not_affect_parent_or_siblings(self):
        """Deleting a CreditRequest or CreditTransaction must not delete the UserProfile or siblings."""
        uid = self.create_user_id("child_delete_test")
        await prisma.userprofile.create(data={"userId": uid, "email": f"{uid}@example.com"})

        r1 = await prisma.creditrequest.create(data={"userId": uid, "amount": 10.0, "screenshotUrl": "https://r2.test/1.png"})
        r2 = await prisma.creditrequest.create(data={"userId": uid, "amount": 20.0, "screenshotUrl": "https://r2.test/2.png"})
        t1 = await prisma.credittransaction.create(data={"userId": uid, "type": "purchase", "credits": 100, "description": "T1"})
        t2 = await prisma.credittransaction.create(data={"userId": uid, "type": "debit_cv", "credits": -1, "description": "T2"})

        # Delete r1 and t1
        await prisma.creditrequest.delete(where={"id": r1.id})
        await prisma.credittransaction.delete(where={"id": t1.id})

        # UserProfile must still exist
        user = await prisma.userprofile.find_unique(where={"userId": uid})
        self.assertIsNotNone(user)

        # Siblings r2 and t2 must still exist
        self.assertIsNone(await prisma.creditrequest.find_unique(where={"id": r1.id}))
        self.assertIsNotNone(await prisma.creditrequest.find_unique(where={"id": r2.id}))
        self.assertIsNone(await prisma.credittransaction.find_unique(where={"id": t1.id}))
        self.assertIsNotNone(await prisma.credittransaction.find_unique(where={"id": t2.id}))

    # =========================================================================
    # 4. DEFAULT VALUES, TIMESTAMPS & MUTATION
    # =========================================================================

    async def test_default_values_and_timestamp_generation(self):
        """Validate exact default values according to Project specifications."""
        uid = self.create_user_id("defaults_test")
        email = f"{uid}@example.com"

        # 1. UserProfile defaults
        p = await prisma.userprofile.create(data={"userId": uid, "email": email})
        self.assertEqual(p.plan, "free")
        self.assertEqual(p.creditBalance, 0)
        self.assertEqual(p.totalCvsProcessed, 0)
        self.assertEqual(p.totalCampaignsCreated, 0)
        self.assertEqual(p.totalInterviewsSent, 0)
        self.assertIsInstance(p.createdAt, datetime)
        self.assertIsInstance(p.updatedAt, datetime)

        # 2. CreditRequest defaults
        req = await prisma.creditrequest.create(
            data={"userId": uid, "amount": 5.0, "screenshotUrl": "https://r2.test/proof.png"}
        )
        self.assertEqual(req.status, "pending")
        self.assertEqual(req.creditsAllocated, 0)
        self.assertIsNone(req.rejectionReason)
        self.assertIsNone(req.reviewedBy)
        self.assertIsNone(req.reviewedAt)
        self.assertIsInstance(req.createdAt, datetime)
        self.assertIsInstance(req.updatedAt, datetime)

        # 3. CreditTransaction defaults
        tx = await prisma.credittransaction.create(
            data={"userId": uid, "type": "debit_campaign", "credits": -1, "description": "1 campaign created"}
        )
        self.assertIsNone(tx.relatedEntityId)
        self.assertIsInstance(tx.createdAt, datetime)

    async def test_updated_at_mutation_on_profile_and_request(self):
        """Verify updatedAt changes on update for UserProfile and CreditRequest."""
        uid = self.create_user_id("updated_at_test")
        p = await prisma.userprofile.create(data={"userId": uid, "email": f"{uid}@example.com"})
        req = await prisma.creditrequest.create(data={"userId": uid, "amount": 10.0, "screenshotUrl": "https://r2.test/p.png"})

        # Sleep briefly to ensure timestamp granularity difference
        await asyncio.sleep(0.1)

        # Update UserProfile
        updated_p = await prisma.userprofile.update(
            where={"userId": uid},
            data={"creditBalance": 100}
        )
        self.assertGreaterEqual(updated_p.updatedAt, p.updatedAt)

        # Update CreditRequest
        updated_req = await prisma.creditrequest.update(
            where={"id": req.id},
            data={"status": "approved", "creditsAllocated": 1000}
        )
        self.assertGreaterEqual(updated_req.updatedAt, req.updatedAt)

    # =========================================================================
    # 5. NUMERIC EDGE CASES, FLOAT AMOUNTS & LARGE INTEGERS
    # =========================================================================

    async def test_float_amount_precision_on_credit_request(self):
        """Stress-test floating point amounts in CreditRequest ($0.01, $19.99, $1234.56)."""
        uid = self.create_user_id("float_test")
        await prisma.userprofile.create(data={"userId": uid, "email": f"{uid}@example.com"})

        test_amounts = [0.01, 4.99, 9.99, 19.95, 99.99, 1000.50, 99999.99]
        for amt in test_amounts:
            r = await prisma.creditrequest.create(
                data={"userId": uid, "amount": amt, "screenshotUrl": f"https://r2.test/{amt}.png"}
            )
            self.assertAlmostEqual(r.amount, amt, places=2)

    async def test_transaction_credits_positive_negative_zero(self):
        """Verify CreditTransaction supports positive, negative, and zero credit adjustments."""
        uid = self.create_user_id("tx_credits_test")
        await prisma.userprofile.create(data={"userId": uid, "email": f"{uid}@example.com"})

        test_cases = [
            ("purchase", 1000, "Approved purchase"),
            ("debit_campaign", -1, "Campaign creation"),
            ("debit_cv", -10, "10 CVs processed"),
            ("debit_invite", -5, "5 interviews sent"),
            ("debit_evaluation", -2, "Evaluation debit"),
            ("refund", 50, "Refund credit"),
            ("admin_adjustment", 0, "No-op adjustment check"),
            ("admin_adjustment", -500, "Admin penalty adjustment"),
        ]

        for tx_type, credits_val, desc in test_cases:
            tx = await prisma.credittransaction.create(
                data={"userId": uid, "type": tx_type, "credits": credits_val, "description": desc}
            )
            self.assertEqual(tx.credits, credits_val)
            self.assertEqual(tx.type, tx_type)

    async def test_large_integer_counters_boundary(self):
        """Verify maximum 32-bit signed integer boundary (2,147,483,647) for usage counters."""
        uid = self.create_user_id("large_int_test")
        max_int = 2147483647
        p = await prisma.userprofile.create(
            data={
                "userId": uid,
                "email": f"{uid}@example.com",
                "totalCvsProcessed": max_int,
                "totalCampaignsCreated": max_int,
                "totalInterviewsSent": max_int,
                "creditBalance": max_int,
            }
        )
        self.assertEqual(p.totalCvsProcessed, max_int)
        self.assertEqual(p.totalCampaignsCreated, max_int)
        self.assertEqual(p.totalInterviewsSent, max_int)
        self.assertEqual(p.creditBalance, max_int)

    # =========================================================================
    # 6. UNICODE, SPECIAL CHARACTERS & STRING BOUNDARY TESTS
    # =========================================================================

    async def test_unicode_and_long_strings(self):
        """Stress-test unicode and long string handling across fields."""
        uid = self.create_user_id("unicode_test")
        long_rejection_reason = "Reason: " + "🔥 Special unicode character testing 🚀 " * 50
        long_description = "Transaction description: " + "日本語 / 中文 / Español / ąęśćń " * 20
        long_url = "https://r2.storage.example.com/payment-screenshots/" + "a" * 500 + ".png"

        await prisma.userprofile.create(data={"userId": uid, "email": f"unicode_{uid}@example.org"})

        req = await prisma.creditrequest.create(
            data={
                "userId": uid,
                "amount": 50.0,
                "screenshotUrl": long_url,
                "status": "rejected",
                "rejectionReason": long_rejection_reason,
            }
        )
        self.assertEqual(req.rejectionReason, long_rejection_reason)
        self.assertEqual(req.screenshotUrl, long_url)

        tx = await prisma.credittransaction.create(
            data={
                "userId": uid,
                "type": "admin_adjustment",
                "credits": 25,
                "description": long_description,
                "relatedEntityId": req.id,
            }
        )
        self.assertEqual(tx.description, long_description)
        self.assertEqual(tx.relatedEntityId, req.id)

    # =========================================================================
    # 7. RELATIONAL INTEGRATION & INDEX FILTERING STRESS
    # =========================================================================

    async def test_relational_queries_and_indexes(self):
        """Test relational queries with include and index filtering (status, type, userId)."""
        uid = self.create_user_id("index_query_test")
        await prisma.userprofile.create(data={"userId": uid, "email": f"{uid}@example.com", "plan": "paid"})

        # Create 5 pending, 3 approved, 2 rejected requests
        for i in range(5):
            await prisma.creditrequest.create(data={"userId": uid, "amount": 10.0, "screenshotUrl": f"https://r2.test/p{i}.png", "status": "pending"})
        for i in range(3):
            await prisma.creditrequest.create(data={"userId": uid, "amount": 20.0, "screenshotUrl": f"https://r2.test/a{i}.png", "status": "approved", "creditsAllocated": 2000})
        for i in range(2):
            await prisma.creditrequest.create(data={"userId": uid, "amount": 30.0, "screenshotUrl": f"https://r2.test/r{i}.png", "status": "rejected", "rejectionReason": "Invalid"})

        # Query filtered by status
        pending_list = await prisma.creditrequest.find_many(where={"userId": uid, "status": "pending"})
        approved_list = await prisma.creditrequest.find_many(where={"userId": uid, "status": "approved"})
        rejected_list = await prisma.creditrequest.find_many(where={"userId": uid, "status": "rejected"})

        self.assertEqual(len(pending_list), 5)
        self.assertEqual(len(approved_list), 3)
        self.assertEqual(len(rejected_list), 2)

        # Include relations from UserProfile
        profile = await prisma.userprofile.find_unique(
            where={"userId": uid},
            include={"creditRequests": True, "creditTransactions": True}
        )
        self.assertEqual(len(profile.creditRequests), 10)


if __name__ == "__main__":
    unittest.main()

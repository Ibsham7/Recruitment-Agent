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
from prisma.errors import UniqueViolationError, ForeignKeyViolationError, PrismaError


class TestMilestone1AdversarialChallenge(unittest.IsolatedAsyncioTestCase):
    """
    Adversarial Challenge Test Suite for Milestone 1 Database Schema & Migration.
    Stress-tests concurrency, nullability rules, full Prisma query API coverage,
    transaction rollback guarantees, cascade deletions, and boundary edge cases.
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

    def _generate_user_id(self, prefix: str = "adv_user") -> str:
        uid = f"{prefix}_{uuid.uuid4().hex[:12]}"
        self.cleanup_user_ids.append(uid)
        return uid

    # =========================================================================
    # CHALLENGE 1: Concurrent Transaction Updates & Atomic Counters
    # =========================================================================
    async def test_concurrent_atomic_balance_and_counter_updates(self):
        """
        Adversarial Concurrency Test:
        Simultaneously launch 40 concurrent async tasks mutating creditBalance
        and usage counters via atomic increment/decrement operations.
        Verify no lost updates or race conditions occur.
        """
        user_id = self._generate_user_id("concurr")
        email = f"{user_id}@example.com"

        # Create baseline profile with initial balance
        initial_balance = 1000
        await prisma.userprofile.create(
            data={
                "userId": user_id,
                "email": email,
                "plan": "paid",
                "creditBalance": initial_balance,
                "totalCvsProcessed": 0,
                "totalCampaignsCreated": 0,
                "totalInterviewsSent": 0,
            }
        )

        num_cv_tasks = 15       # -5 credits each, +1 cv
        num_camp_tasks = 10     # -10 credits each, +1 campaign
        num_invite_tasks = 10   # -2 credits each, +1 interview
        num_credit_tasks = 10   # +25 credits each (purchase/adjustment)

        async def worker_cv():
            await prisma.userprofile.update(
                where={"userId": user_id},
                data={
                    "creditBalance": {"decrement": 5},
                    "totalCvsProcessed": {"increment": 1},
                },
            )

        async def worker_camp():
            await prisma.userprofile.update(
                where={"userId": user_id},
                data={
                    "creditBalance": {"decrement": 10},
                    "totalCampaignsCreated": {"increment": 1},
                },
            )

        async def worker_invite():
            await prisma.userprofile.update(
                where={"userId": user_id},
                data={
                    "creditBalance": {"decrement": 2},
                    "totalInterviewsSent": {"increment": 1},
                },
            )

        async def worker_credit():
            await prisma.userprofile.update(
                where={"userId": user_id},
                data={
                    "creditBalance": {"increment": 25},
                },
            )

        tasks = []
        for _ in range(num_cv_tasks):
            tasks.append(worker_cv())
        for _ in range(num_camp_tasks):
            tasks.append(worker_camp())
        for _ in range(num_invite_tasks):
            tasks.append(worker_invite())
        for _ in range(num_credit_tasks):
            tasks.append(worker_credit())

        # Execute all mutations concurrently
        await asyncio.gather(*tasks)

        # Expected calculations
        expected_balance = (
            initial_balance
            - (num_cv_tasks * 5)
            - (num_camp_tasks * 10)
            - (num_invite_tasks * 2)
            + (num_credit_tasks * 25)
        )
        # 1000 - 75 - 100 - 20 + 250 = 1055

        # Fetch fresh record from DB
        profile = await prisma.userprofile.find_unique(where={"userId": user_id})
        self.assertIsNotNone(profile)
        self.assertEqual(profile.creditBalance, expected_balance, f"Race condition detected! Expected {expected_balance}, got {profile.creditBalance}")
        self.assertEqual(profile.totalCvsProcessed, num_cv_tasks)
        self.assertEqual(profile.totalCampaignsCreated, num_camp_tasks)
        self.assertEqual(profile.totalInterviewsSent, num_invite_tasks)

    # =========================================================================
    # CHALLENGE 2: Nullability Rules and Optional Field Constraints
    # =========================================================================
    async def test_nullability_and_optional_fields(self):
        """
        Adversarial Nullability Test:
        Verify nullable fields (rejectionReason, reviewedBy, reviewedAt, relatedEntityId)
        accept None, retain None by default, and update cleanly between null and non-null states.
        """
        user_id = self._generate_user_id("nulltest")
        email = f"{user_id}@example.com"

        await prisma.userprofile.create(
            data={"userId": user_id, "email": email}
        )

        # 1. CreditRequest: create with minimal required fields
        req = await prisma.creditrequest.create(
            data={
                "userId": user_id,
                "amount": 49.99,
                "screenshotUrl": "https://r2.domain.com/payment-screenshots/receipt.png",
            }
        )
        self.assertIsNone(req.rejectionReason)
        self.assertIsNone(req.reviewedBy)
        self.assertIsNone(req.reviewedAt)
        self.assertEqual(req.status, "pending")
        self.assertEqual(req.creditsAllocated, 0)

        # 2. Update CreditRequest with rejectionReason and reviewer details
        review_time = datetime.now(timezone.utc)
        rejection_text = "Receipt blurred. Transaction ID not visible. Please re-upload a clear screenshot."
        updated_req = await prisma.creditrequest.update(
            where={"id": req.id},
            data={
                "status": "rejected",
                "rejectionReason": rejection_text,
                "reviewedBy": "admin@company.com",
                "reviewedAt": review_time,
            },
        )
        self.assertEqual(updated_req.status, "rejected")
        self.assertEqual(updated_req.rejectionReason, rejection_text)
        self.assertEqual(updated_req.reviewedBy, "admin@company.com")
        self.assertIsNotNone(updated_req.reviewedAt)

        # 3. Clear fields back to None (re-open / reset)
        reset_req = await prisma.creditrequest.update(
            where={"id": req.id},
            data={
                "status": "pending",
                "rejectionReason": None,
                "reviewedBy": None,
                "reviewedAt": None,
            },
        )
        self.assertIsNone(reset_req.rejectionReason)
        self.assertIsNone(reset_req.reviewedBy)
        self.assertIsNone(reset_req.reviewedAt)

        # 4. CreditTransaction: relatedEntityId nullable vs populated
        tx_no_rel = await prisma.credittransaction.create(
            data={
                "userId": user_id,
                "type": "debit_cv",
                "credits": -1,
                "description": "CV upload debit",
                "relatedEntityId": None,
            }
        )
        self.assertIsNone(tx_no_rel.relatedEntityId)

        entity_uuid = str(uuid.uuid4())
        tx_with_rel = await prisma.credittransaction.create(
            data={
                "userId": user_id,
                "type": "purchase",
                "credits": 5000,
                "description": "5,000 credits allocated from purchase request",
                "relatedEntityId": entity_uuid,
            }
        )
        self.assertEqual(tx_with_rel.relatedEntityId, entity_uuid)

    # =========================================================================
    # CHALLENGE 3: Complete Prisma Model Query Operations
    # =========================================================================
    async def test_full_prisma_model_query_operations(self):
        """
        Verify that find_unique, find_first, find_many, create, update,
        update_many, delete, delete_many, upsert, count, and aggregate
        execute seamlessly across all Milestone 1 models.
        """
        user_id = self._generate_user_id("queryops")
        email = f"{user_id}@example.com"

        # 1. CREATE
        created = await prisma.userprofile.create(
            data={
                "userId": user_id,
                "email": email,
                "plan": "free",
                "creditBalance": 100,
            }
        )
        self.assertEqual(created.userId, user_id)

        # 2. FIND_UNIQUE (by userId and by id)
        by_user_id = await prisma.userprofile.find_unique(where={"userId": user_id})
        self.assertIsNotNone(by_user_id)
        self.assertEqual(by_user_id.id, created.id)

        by_pk = await prisma.userprofile.find_unique(where={"id": created.id})
        self.assertIsNotNone(by_pk)
        self.assertEqual(by_pk.userId, user_id)

        # 3. FIND_FIRST
        first_match = await prisma.userprofile.find_first(
            where={"email": email}
        )
        self.assertIsNotNone(first_match)
        self.assertEqual(first_match.userId, user_id)

        # 4. UPSERT (Update existing)
        upserted_existing = await prisma.userprofile.upsert(
            where={"userId": user_id},
            data={
                "create": {"userId": user_id, "email": email, "plan": "free"},
                "update": {"creditBalance": 250},
            },
        )
        self.assertEqual(upserted_existing.creditBalance, 250)

        # 5. UPSERT (Create new)
        new_uid = self._generate_user_id("upsert_new")
        upserted_new = await prisma.userprofile.upsert(
            where={"userId": new_uid},
            data={
                "create": {"userId": new_uid, "email": f"{new_uid}@example.com", "plan": "paid", "creditBalance": 500},
                "update": {"creditBalance": 999},
            },
        )
        self.assertEqual(upserted_new.userId, new_uid)
        self.assertEqual(upserted_new.plan, "paid")
        self.assertEqual(upserted_new.creditBalance, 500)

        # 6. COUNT
        total_profiles = await prisma.userprofile.count()
        self.assertGreaterEqual(total_profiles, 2)

        user_count = await prisma.userprofile.count(where={"userId": user_id})
        self.assertEqual(user_count, 1)

        # 7. GROUP_BY & AGGREGATIONS
        # Create transactions for user_id to test aggregations
        await prisma.credittransaction.create(
            data={"userId": user_id, "type": "purchase", "credits": 1000, "description": "Buy 1"}
        )
        await prisma.credittransaction.create(
            data={"userId": user_id, "type": "purchase", "credits": 2000, "description": "Buy 2"}
        )
        await prisma.credittransaction.create(
            data={"userId": user_id, "type": "debit_campaign", "credits": -1, "description": "Camp 1"}
        )

        group_res = await prisma.credittransaction.group_by(
            by=["type"],
            where={"userId": user_id},
            sum={"credits": True},
            avg={"credits": True},
            min={"credits": True},
            max={"credits": True},
            count=True,
        )
        self.assertIsNotNone(group_res)
        self.assertEqual(len(group_res), 2)  # "purchase" and "debit_campaign"

        purchase_agg = next(g for g in group_res if g["type"] == "purchase")
        self.assertEqual(purchase_agg.get("_sum", {}).get("credits"), 3000)
        self.assertEqual(purchase_agg.get("_avg", {}).get("credits"), 1500.0)
        self.assertEqual(purchase_agg.get("_min", {}).get("credits"), 1000)
        self.assertEqual(purchase_agg.get("_max", {}).get("credits"), 2000)
        self.assertEqual(purchase_agg.get("_count", {}).get("_all"), 2)

        # 8. FIND_UNIQUE_OR_RAISE & FIND_FIRST_OR_RAISE
        found_or_raise = await prisma.userprofile.find_unique_or_raise(where={"userId": user_id})
        self.assertEqual(found_or_raise.userId, user_id)

        first_or_raise = await prisma.userprofile.find_first_or_raise(where={"email": email})
        self.assertEqual(first_or_raise.email, email)

        # 9. FIND_MANY with pagination (take, skip, order)
        many_txs = await prisma.credittransaction.find_many(
            where={"userId": user_id},
            take=2,
            skip=0,
            order={"createdAt": "desc"},
        )
        self.assertEqual(len(many_txs), 2)

        # 10. UPDATE_MANY
        update_many_res = await prisma.credittransaction.update_many(
            where={"userId": user_id, "type": "purchase"},
            data={"description": "Bulk Updated Purchase"},
        )
        self.assertEqual(update_many_res, 2)

        # 11. DELETE_MANY
        deleted_count = await prisma.credittransaction.delete_many(
            where={"userId": user_id}
        )
        self.assertEqual(deleted_count, 3)

        # 12. DELETE
        await prisma.userprofile.delete(where={"userId": new_uid})
        check_deleted = await prisma.userprofile.find_unique(where={"userId": new_uid})
        self.assertIsNone(check_deleted)

    # =========================================================================
    # CHALLENGE 4: Foreign Key Constraints & Cascade Deletion Invariants
    # =========================================================================
    async def test_foreign_key_constraints_and_cascades(self):
        """
        Adversarial Foreign Key & Cascade Invariant Test:
        - Inserting child records (CreditRequest/CreditTransaction) without parent UserProfile fails.
        - Deleting parent UserProfile cascades and completely removes all child records.
        - Deleting child records does not affect parent UserProfile.
        """
        non_existent_uid = f"ghost_user_{uuid.uuid4().hex[:12]}"

        # 1. Expect Foreign Key violation on orphan CreditRequest
        with self.assertRaises((ForeignKeyViolationError, PrismaError)):
            await prisma.creditrequest.create(
                data={
                    "userId": non_existent_uid,
                    "amount": 10.0,
                    "screenshotUrl": "https://r2.storage.com/ghost.png",
                }
            )

        # 2. Expect Foreign Key violation on orphan CreditTransaction
        with self.assertRaises((ForeignKeyViolationError, PrismaError)):
            await prisma.credittransaction.create(
                data={
                    "userId": non_existent_uid,
                    "type": "debit_cv",
                    "credits": -1,
                    "description": "Orphan transaction",
                }
            )

        # 3. Create parent with multiple children across both tables
        parent_uid = self._generate_user_id("cascade_parent")
        await prisma.userprofile.create(
            data={"userId": parent_uid, "email": f"{parent_uid}@test.com"}
        )

        req1 = await prisma.creditrequest.create(
            data={"userId": parent_uid, "amount": 10.0, "screenshotUrl": "https://test.com/1.png"}
        )
        req2 = await prisma.creditrequest.create(
            data={"userId": parent_uid, "amount": 20.0, "screenshotUrl": "https://test.com/2.png"}
        )

        tx1 = await prisma.credittransaction.create(
            data={"userId": parent_uid, "type": "purchase", "credits": 1000, "description": "P1"}
        )
        tx2 = await prisma.credittransaction.create(
            data={"userId": parent_uid, "type": "debit_cv", "credits": -1, "description": "D1"}
        )

        # 4. Deleting a child CreditRequest should leave parent and other children intact
        await prisma.creditrequest.delete(where={"id": req1.id})
        parent_check = await prisma.userprofile.find_unique(where={"userId": parent_uid})
        self.assertIsNotNone(parent_check)
        req2_check = await prisma.creditrequest.find_unique(where={"id": req2.id})
        self.assertIsNotNone(req2_check)

        # 5. Deleting parent UserProfile MUST cascade and delete req2, tx1, tx2
        await prisma.userprofile.delete(where={"userId": parent_uid})

        self.assertIsNone(await prisma.creditrequest.find_unique(where={"id": req2.id}))
        self.assertIsNone(await prisma.credittransaction.find_unique(where={"id": tx1.id}))
        self.assertIsNone(await prisma.credittransaction.find_unique(where={"id": tx2.id}))

    # =========================================================================
    # CHALLENGE 5: Atomic Batch Transactions & Rollback Guarantees
    # =========================================================================
    async def test_atomic_transaction_and_rollback_guarantee(self):
        """
        Adversarial Transaction Rollback Test:
        Using prisma.tx(), verify that if an error occurs mid-transaction,
        all partial changes (e.g. credit balance deduction) are completely rolled back.
        """
        user_id = self._generate_user_id("tx_rollback")
        initial_balance = 500

        await prisma.userprofile.create(
            data={
                "userId": user_id,
                "email": f"{user_id}@test.com",
                "plan": "paid",
                "creditBalance": initial_balance,
            }
        )

        # Execute transaction that fails intentionally at step 2
        try:
            async with prisma.tx() as transaction:
                # Step 1: Deduct credits
                await transaction.userprofile.update(
                    where={"userId": user_id},
                    data={"creditBalance": {"decrement": 100}},
                )
                # Step 2: Trigger error
                raise RuntimeError("Simulated mid-transaction system crash!")
        except RuntimeError:
            pass  # Expected exception

        # Verify rollback: credit balance MUST remain at initial_balance (500)
        fresh_profile = await prisma.userprofile.find_unique(where={"userId": user_id})
        self.assertEqual(
            fresh_profile.creditBalance,
            initial_balance,
            f"Rollback failed! Balance was modified to {fresh_profile.creditBalance} despite transaction abort.",
        )

    # =========================================================================
    # CHALLENGE 6: Extreme Boundary Values & Precision
    # =========================================================================
    async def test_extreme_boundary_values_and_precision(self):
        """
        Adversarial Boundaries Test:
        - Floating point precision on amounts (e.g. 0.01, 9999.99).
        - Large 32-bit integer credit balances.
        - Long text strings for rejection reason, description, and screenshot URL.
        - Unicode and special character support.
        """
        user_id = self._generate_user_id("bounds")
        email = f"user+special.chars_123@{user_id}.domain.co.uk"

        # Large 32-bit signed integer within PostgreSQL Int range (-2,147,483,648 to 2,147,483,647)
        large_balance = 1_000_000_000

        profile = await prisma.userprofile.create(
            data={
                "userId": user_id,
                "email": email,
                "plan": "paid",
                "creditBalance": large_balance,
            }
        )
        self.assertEqual(profile.creditBalance, large_balance)

        # Precise float amount & long screenshot URL
        long_url = "https://r2.storage.example.com/payment-screenshots/" + ("a" * 500) + ".png"
        long_rejection = "Rejection Reason with Special Characters: ñ, ü, 🚀, <script>alert(1)</script> " + ("X" * 1000)

        req = await prisma.creditrequest.create(
            data={
                "userId": user_id,
                "amount": 9999.95,
                "screenshotUrl": long_url,
                "status": "rejected",
                "rejectionReason": long_rejection,
                "reviewedBy": "admin_super_user@corp.internal",
                "reviewedAt": datetime.now(timezone.utc),
            }
        )
        self.assertAlmostEqual(req.amount, 9999.95, places=2)
        self.assertEqual(req.screenshotUrl, long_url)
        self.assertEqual(req.rejectionReason, long_rejection)

        # Transaction with negative debit and unicode description
        unicode_desc = "Deduction for candidate evaluation with special chars: 🎯, 日本語, €100.00"
        tx = await prisma.credittransaction.create(
            data={
                "userId": user_id,
                "type": "debit_evaluation",
                "credits": -2,
                "description": unicode_desc,
                "relatedEntityId": req.id,
            }
        )
        self.assertEqual(tx.credits, -2)
        self.assertEqual(tx.description, unicode_desc)
        self.assertEqual(tx.relatedEntityId, req.id)


if __name__ == "__main__":
    unittest.main()

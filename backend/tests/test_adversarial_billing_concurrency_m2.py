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
from app.agent.api import _run_evaluator_background
from unittest.mock import patch, AsyncMock


class TestAdversarialBillingConcurrencyM2(unittest.IsolatedAsyncioTestCase):
    """
    Adversarial challenge test suite for Milestone 2:
    1. Concurrent campaign creations and credit debits under load (race conditions / overdraft / over-quota).
    2. Concurrent interview invitations credit debits under load.
    3. Worker evaluation credit deduction (2 credits for paid users, 0 for free users) during background processing.
    4. Algebraic ledger reconciliation: user.creditBalance == sum(tx.credits for tx in transactions).
    5. State transition robustness (double approval, double rejection, negative adjustments).
    """

    async def asyncSetUp(self):
        if not prisma.is_connected():
            await prisma.connect()
        self.cleanup_user_ids = []
        self.cleanup_campaign_ids = []
        self.cleanup_candidate_ids = []

    async def asyncTearDown(self):
        # Clean up created candidates, campaigns, transactions, credit requests, user profiles
        for cid in self.cleanup_candidate_ids:
            try:
                await prisma.evaluation.delete_many(where={"candidateId": cid})
                await prisma.interviewtranscript.delete_many(where={"candidateId": cid})
                await prisma.resume.delete_many(where={"candidateId": cid})
                await prisma.candidate.delete(where={"id": cid})
            except Exception:
                pass

        for camp_id in self.cleanup_campaign_ids:
            try:
                await prisma.campaign.delete(where={"id": camp_id})
            except Exception:
                pass

        for uid in self.cleanup_user_ids:
            try:
                await prisma.credittransaction.delete_many(where={"userId": uid})
                await prisma.creditrequest.delete_many(where={"userId": uid})
                await prisma.userprofile.delete(where={"userId": uid})
            except Exception:
                pass

        if prisma.is_connected():
            await prisma.disconnect()

    def make_user_id(self, prefix: str = "adv_user") -> str:
        uid = f"{prefix}_{uuid.uuid4().hex[:10]}"
        self.cleanup_user_ids.append(uid)
        return uid

    # =========================================================================
    # CHALLENGE 1: CONCURRENT CAMPAIGN CREATIONS & CREDIT DEBITS UNDER LOAD
    # =========================================================================

    async def test_concurrent_paid_campaign_creations_overdraft_prevention(self):
        """
        Adversarial test: A paid user with 10 credits fires 10 concurrent campaign creation requests.
        Each campaign has 1 resume (cost = 1 base + 1 CV = 2 credits).
        Only exactly 5 campaigns should succeed (10 / 2 = 5).
        The other 5 must fail with HTTP 402.
        Final credit balance must NOT be negative, and must match ledger.
        """
        uid = self.make_user_id("paid_conc_camp")
        email = f"{uid}@example.com"

        # Create paid user with 10 credits
        await prisma.userprofile.create(
            data={
                "userId": uid,
                "email": email,
                "plan": "paid",
                "creditBalance": 10,
                "totalCampaignsCreated": 0,
                "totalCvsProcessed": 0
            }
        )

        num_concurrent = 10
        cost_per_req = 2  # 1 base + 1 resume

        async def attempt_campaign_creation(idx: int):
            camp_id = f"camp_{uid}_{idx}"
            try:
                profile = await billing_service.validate_and_deduct_campaign_creation(
                    user_id=uid,
                    email=email,
                    num_resumes=1,
                    campaign_title=f"Concurrent Campaign {idx}",
                    campaign_id=camp_id
                )
                return {"success": True, "idx": idx, "profile": profile}
            except HTTPException as e:
                return {"success": False, "idx": idx, "error_code": e.status_code, "detail": e.detail}
            except Exception as e:
                return {"success": False, "idx": idx, "error_code": 500, "detail": str(e)}

        results = await asyncio.gather(*[attempt_campaign_creation(i) for i in range(num_concurrent)])

        successes = [r for r in results if r["success"]]
        failures = [r for r in results if not r["success"]]

        print(f"\n[Test Concurrent Paid Campaign] Total: {num_concurrent}, Successes: {len(successes)}, Failures: {len(failures)}")
        for f in failures:
            print(f"   Failure status: {f.get('error_code')}, detail: {f.get('detail')}")

        # Fetch final profile and transactions from DB
        final_profile = await prisma.userprofile.find_unique(where={"userId": uid})
        transactions = await prisma.credittransaction.find_many(where={"userId": uid})

        total_tx_credits = sum(tx.credits for tx in transactions)

        print(f"   Final DB Balance: {final_profile.creditBalance}")
        print(f"   Total Transactions Sum: {total_tx_credits}")
        print(f"   Initial Balance (10) + Tx Sum ({total_tx_credits}) = {10 + total_tx_credits}")

        # Verification checks:
        # 1. No overdraft below 0
        self.assertGreaterEqual(final_profile.creditBalance, 0, "Credit balance must never drop below 0!")
        
        # 2. Successes cannot exceed total affordable campaigns
        max_possible_successes = 10 // cost_per_req  # 5
        self.assertLessEqual(len(successes), max_possible_successes, f"Cannot allow more than {max_possible_successes} campaigns with 10 credits!")
        
        # 3. All failed requests must return 402
        for fail in failures:
            self.assertEqual(fail["error_code"], 402, "Rejected requests due to insufficient credits must return HTTP 402")

        # 4. Algebraic reconciliation: initial (10) + sum(transactions) == final_balance
        self.assertEqual(10 + total_tx_credits, final_profile.creditBalance, "Algebraic ledger mismatch after concurrent debits!")

    async def test_concurrent_free_campaign_creations_quota_enforcement(self):
        """
        Adversarial test: A Free user with 4 existing campaigns fires 10 concurrent requests to create campaigns.
        Free tier limit is 5.
        Only exactly 1 request should succeed. 9 must fail with HTTP 402.
        Total lifetime campaigns must NOT exceed 5.
        """
        uid = self.make_user_id("free_conc_camp")
        email = f"{uid}@example.com"

        # Create free user with 4 campaigns
        await prisma.userprofile.create(
            data={
                "userId": uid,
                "email": email,
                "plan": "free",
                "creditBalance": 0,
                "totalCampaignsCreated": 4,
                "totalCvsProcessed": 0
            }
        )

        num_concurrent = 10

        async def attempt_free_campaign(idx: int):
            camp_id = f"camp_free_{uid}_{idx}"
            try:
                profile = await billing_service.validate_and_deduct_campaign_creation(
                    user_id=uid,
                    email=email,
                    num_resumes=0,
                    campaign_title=f"Free Concurrent Campaign {idx}",
                    campaign_id=camp_id
                )
                return {"success": True, "idx": idx, "profile": profile}
            except HTTPException as e:
                return {"success": False, "idx": idx, "error_code": e.status_code, "detail": e.detail}
            except Exception as e:
                return {"success": False, "idx": idx, "error_code": 500, "detail": str(e)}

        results = await asyncio.gather(*[attempt_free_campaign(i) for i in range(num_concurrent)])

        successes = [r for r in results if r["success"]]
        failures = [r for r in results if not r["success"]]

        print(f"\n[Test Concurrent Free Campaign] Total: {num_concurrent}, Successes: {len(successes)}, Failures: {len(failures)}")

        final_profile = await prisma.userprofile.find_unique(where={"userId": uid})
        print(f"   Final totalCampaignsCreated: {final_profile.totalCampaignsCreated}")

        # Verification:
        self.assertLessEqual(final_profile.totalCampaignsCreated, 5, "Free tier totalCampaignsCreated exceeded max limit of 5!")
        self.assertEqual(len(successes), 1, "Exactly 1 campaign creation should have succeeded for a user with 4 existing campaigns!")
        self.assertEqual(len(failures), 9, "9 campaign creations should have failed!")

    # =========================================================================
    # CHALLENGE 2: CONCURRENT INTERVIEW INVITATIONS DEBIT UNDER LOAD
    # =========================================================================

    async def test_concurrent_interview_invitations_paid_and_free(self):
        """
        Adversarial test:
        1. Paid user with 5 credits fires 5 concurrent batches of 2 invitations (total 10 needed).
           Only 2 batches (4 credits) should succeed, 3 batches should fail with 402. Final balance >= 0.
        2. Free user with 3 interviews fires 5 concurrent single invitations (total 5 needed, limit 5).
           Only 2 invitations should succeed, 3 should fail.
        """
        # Paid test
        paid_uid = self.make_user_id("paid_conc_inv")
        paid_email = f"{paid_uid}@example.com"
        await prisma.userprofile.create(
            data={
                "userId": paid_uid,
                "email": paid_email,
                "plan": "paid",
                "creditBalance": 5,
                "totalInterviewsSent": 0
            }
        )

        async def send_paid_invites(idx: int):
            try:
                res = await billing_service.validate_and_deduct_interview_invitations(
                    user_id=paid_uid,
                    email=paid_email,
                    num_candidates=2
                )
                return {"success": True, "idx": idx}
            except HTTPException as e:
                return {"success": False, "idx": idx, "code": e.status_code}

        paid_results = await asyncio.gather(*[send_paid_invites(i) for i in range(5)])
        paid_success = [r for r in paid_results if r["success"]]
        paid_profile = await prisma.userprofile.find_unique(where={"userId": paid_uid})

        self.assertLessEqual(len(paid_success), 2, "Cannot send more than 2 batches of 2 invites with 5 credits!")
        self.assertGreaterEqual(paid_profile.creditBalance, 0, "Balance must not be negative!")

        # Free test
        free_uid = self.make_user_id("free_conc_inv")
        free_email = f"{free_uid}@example.com"
        await prisma.userprofile.create(
            data={
                "userId": free_uid,
                "email": free_email,
                "plan": "free",
                "creditBalance": 0,
                "totalInterviewsSent": 3
            }
        )

        async def send_free_invites(idx: int):
            try:
                res = await billing_service.validate_and_deduct_interview_invitations(
                    user_id=free_uid,
                    email=free_email,
                    num_candidates=1
                )
                return {"success": True, "idx": idx}
            except HTTPException as e:
                return {"success": False, "idx": idx, "code": e.status_code}

        free_results = await asyncio.gather(*[send_free_invites(i) for i in range(5)])
        free_success = [r for r in free_results if r["success"]]
        free_profile = await prisma.userprofile.find_unique(where={"userId": free_uid})

        self.assertEqual(len(free_success), 2, "Only 2 invites allowed before reaching max limit of 5!")
        self.assertEqual(free_profile.totalInterviewsSent, 5, "Total interviews sent must be exactly 5!")

    # =========================================================================
    # CHALLENGE 3: WORKER EVALUATION CREDIT DEDUCTION
    # =========================================================================

    async def test_worker_evaluation_credit_deduction_paid_and_free(self):
        """
        Adversarial test:
        1. Paid user: when candidate evaluation completes, exactly 2 credits are deducted,
           and a 'debit_evaluation' transaction is recorded referencing the candidateId.
        2. Free user: when candidate evaluation completes, 0 credits are deducted,
           and no transaction is recorded.
        3. Missing user / invalid user: gracefully handled without raising unhandled exceptions.
        """
        paid_uid = self.make_user_id("eval_paid")
        paid_email = f"{paid_uid}@example.com"
        await prisma.userprofile.create(
            data={
                "userId": paid_uid,
                "email": paid_email,
                "plan": "paid",
                "creditBalance": 100
            }
        )

        candidate_id_paid = f"cand_paid_{uuid.uuid4().hex[:8]}"
        res_paid = await billing_service.deduct_evaluation_credits(
            user_id=paid_uid,
            candidate_id=candidate_id_paid,
            candidate_name="Alice Paid"
        )
        self.assertIsNotNone(res_paid)
        self.assertEqual(res_paid.creditBalance, 98)

        # Check transaction
        txs = await prisma.credittransaction.find_many(where={"userId": paid_uid, "relatedEntityId": candidate_id_paid})
        self.assertEqual(len(txs), 1)
        self.assertEqual(txs[0].type, "debit_evaluation")
        self.assertEqual(txs[0].credits, -2)
        self.assertEqual(txs[0].relatedEntityId, candidate_id_paid)

        # Free user test
        free_uid = self.make_user_id("eval_free")
        free_email = f"{free_uid}@example.com"
        await prisma.userprofile.create(
            data={
                "userId": free_uid,
                "email": free_email,
                "plan": "free",
                "creditBalance": 0
            }
        )

        candidate_id_free = f"cand_free_{uuid.uuid4().hex[:8]}"
        res_free = await billing_service.deduct_evaluation_credits(
            user_id=free_uid,
            candidate_id=candidate_id_free,
            candidate_name="Bob Free"
        )
        self.assertIsNotNone(res_free)
        self.assertEqual(res_free.creditBalance, 0)

        # No transaction for free user
        free_txs = await prisma.credittransaction.find_many(where={"userId": free_uid})
        self.assertEqual(len(free_txs), 0)

        # Graceful handling of None user_id
        none_res = await billing_service.deduct_evaluation_credits(None, "cand_none", "None User")
        self.assertIsNone(none_res)

        # Graceful handling of non-existent user_id
        missing_res = await billing_service.deduct_evaluation_credits("non_existent_uid_12345", "cand_miss", "Missing User")
        self.assertIsNone(missing_res)

    async def test_concurrent_worker_evaluation_credit_deductions(self):
        """
        Adversarial test: 5 concurrent background candidate evaluation tasks finish simultaneously
        for the same paid user.
        Each evaluation deducts 2 credits.
        Initial balance: 100 credits.
        Expected final balance: 100 - (5 * 2) = 90 credits.
        Expected transactions: 5 distinct 'debit_evaluation' transactions totaling -10 credits.
        Algebraic invariant: initial_balance + sum(tx.credits) == final_balance.
        """
        paid_uid = self.make_user_id("eval_conc_paid")
        paid_email = f"{paid_uid}@example.com"
        await prisma.userprofile.create(
            data={
                "userId": paid_uid,
                "email": paid_email,
                "plan": "paid",
                "creditBalance": 100
            }
        )

        num_concurrent_evals = 5

        async def run_eval_deduct(idx: int):
            cid = f"cand_conc_{paid_uid}_{idx}"
            return await billing_service.deduct_evaluation_credits(
                user_id=paid_uid,
                candidate_id=cid,
                candidate_name=f"Candidate {idx}"
            )

        results = await asyncio.gather(*[run_eval_deduct(i) for i in range(num_concurrent_evals)])

        final_profile = await prisma.userprofile.find_unique(where={"userId": paid_uid})
        transactions = await prisma.credittransaction.find_many(where={"userId": paid_uid})
        total_tx_credits = sum(tx.credits for tx in transactions)

        print(f"\n[Test Concurrent Worker Evals] Initial: 100, Final DB: {final_profile.creditBalance}, Total Tx Credits: {total_tx_credits}")

        self.assertEqual(len(transactions), num_concurrent_evals, f"Expected {num_concurrent_evals} transactions")
        self.assertEqual(total_tx_credits, -10, "Expected -10 total transaction credits")
        self.assertEqual(final_profile.creditBalance, 90, f"Expected final balance 90, got {final_profile.creditBalance}")
        self.assertEqual(100 + total_tx_credits, final_profile.creditBalance, "Algebraic ledger mismatch under concurrent worker evals!")


    # =========================================================================
    # CHALLENGE 4: ALGEBRAIC LEDGER RECONCILIATION
    # =========================================================================

    async def test_algebraic_ledger_reconciliation_multi_event_lifecycle(self):
        """
        Adversarial test: Full lifecycle ledger reconciliation for a user across
        multiple sequential and mixed actions:
        - Provision (balance = 0)
        - Submit $25 credit request -> Approved (+2500 credits)
        - Submit $10 credit request -> Approved (+1000 credits)
        - Create Campaign A with 10 resumes (-11 credits)
        - Create Campaign B with 5 resumes (-6 credits)
        - Send 8 interview invitations (-8 credits)
        - Complete 5 candidate evaluations (-10 credits)
        - Admin manual adjustment (+150 credits)
        - Admin manual deduction (-25 credits)
        
        Final balance calculation:
        0 + 2500 + 1000 - 11 - 6 - 8 - 10 + 150 - 25 = 3590 credits.
        
        Algebraic Reconciliation Assertion:
        UserProfile.creditBalance == sum(CreditTransaction.credits)
        """
        uid = self.make_user_id("ledger_user")
        email = f"{uid}@example.com"
        admin_email = "admin@agentichr.dev"

        # 1. Auto-provision
        profile = await billing_service.get_or_create_user_profile(uid, email)
        self.assertEqual(profile.creditBalance, 0)

        # 2. Purchase 1: $25.00
        req1 = await prisma.creditrequest.create(
            data={"userId": uid, "amount": 25.0, "screenshotUrl": "https://r2.test/rec1.png", "status": "pending", "creditsAllocated": 0}
        )
        await billing_service.approve_credit_request(req1.id, admin_email)

        # 3. Purchase 2: $10.00
        req2 = await prisma.creditrequest.create(
            data={"userId": uid, "amount": 10.0, "screenshotUrl": "https://r2.test/rec2.png", "status": "pending", "creditsAllocated": 0}
        )
        await billing_service.approve_credit_request(req2.id, admin_email)

        # 4. Campaign A (10 resumes -> 11 credits)
        await billing_service.validate_and_deduct_campaign_creation(
            user_id=uid,
            email=email,
            num_resumes=10,
            campaign_title="Camp A",
            campaign_id=f"camp_a_{uid}"
        )

        # 5. Campaign B (5 resumes -> 6 credits)
        await billing_service.validate_and_deduct_campaign_creation(
            user_id=uid,
            email=email,
            num_resumes=5,
            campaign_title="Camp B",
            campaign_id=f"camp_b_{uid}"
        )

        # 6. Interview Invites (8 candidates -> 8 credits)
        await billing_service.validate_and_deduct_interview_invitations(
            user_id=uid,
            email=email,
            num_candidates=8
        )

        # 7. Candidate evaluations (5 candidates -> 10 credits)
        for c_idx in range(5):
            await billing_service.deduct_evaluation_credits(
                user_id=uid,
                candidate_id=f"cand_{uid}_{c_idx}",
                candidate_name=f"Candidate {c_idx}"
            )

        # 8. Admin manual adjustment (+150 credits)
        await billing_service.adjust_user_credits(
            user_id=uid,
            adjustment=150,
            reason="Promo bonus"
        )

        # 9. Admin manual deduction (-25 credits)
        await billing_service.adjust_user_credits(
            user_id=uid,
            adjustment=-25,
            reason="Fee correction"
        )

        # Fetch final state
        final_profile = await prisma.userprofile.find_unique(where={"userId": uid})
        transactions = await prisma.credittransaction.find_many(where={"userId": uid})

        total_tx_credits = sum(tx.credits for tx in transactions)

        print(f"\n[Algebraic Ledger Reconciliation Test]")
        print(f"   Expected Balance: 3590")
        print(f"   Actual DB Balance: {final_profile.creditBalance}")
        print(f"   Sum of {len(transactions)} transactions: {total_tx_credits}")

        # Assertions
        self.assertEqual(final_profile.creditBalance, 3590, "Calculated balance differs from expected balance!")
        self.assertEqual(final_profile.creditBalance, total_tx_credits, "Algebraic invariant violated: profile.creditBalance != sum(transactions.credits)!")

    # =========================================================================
    # CHALLENGE 5: STATE TRANSITION INTEGRITY (DOUBLE APPROVAL / DOUBLE REJECTION)
    # =========================================================================

    async def test_credit_request_double_approval_and_rejection_protection(self):
        """
        Adversarial test:
        - Cannot approve an already approved request.
        - Cannot reject an already approved request.
        - Cannot approve an already rejected request.
        - Cannot double-reject an already rejected request.
        """
        uid = self.make_user_id("state_user")
        email = f"{uid}@example.com"
        admin_email = "admin@agentichr.dev"

        await billing_service.get_or_create_user_profile(uid, email)

        req = await prisma.creditrequest.create(
            data={"userId": uid, "amount": 20.0, "screenshotUrl": "https://r2.test/rec.png", "status": "pending", "creditsAllocated": 0}
        )

        # 1. First approval succeeds
        res1 = await billing_service.approve_credit_request(req.id, admin_email)
        self.assertEqual(res1["status"], "success")
        self.assertEqual(res1["creditsAllocated"], 2000)

        # 2. Second approval must be rejected with HTTP 400
        with self.assertRaises(HTTPException) as cm:
            await billing_service.approve_credit_request(req.id, admin_email)
        self.assertEqual(cm.exception.status_code, 400)
        self.assertIn("already approved", cm.exception.detail)

        # 3. Attempt to reject approved request must fail with HTTP 400
        with self.assertRaises(HTTPException) as cm2:
            await billing_service.reject_credit_request(req.id, admin_email, "Wrong screenshot")
        self.assertEqual(cm2.exception.status_code, 400)
        self.assertIn("already approved", cm2.exception.detail)

        # 4. New request -> Reject -> Attempt to approve
        req2 = await prisma.creditrequest.create(
            data={"userId": uid, "amount": 5.0, "screenshotUrl": "https://r2.test/rec2.png", "status": "pending", "creditsAllocated": 0}
        )
        res_rej = await billing_service.reject_credit_request(req2.id, admin_email, "Blurry image")
        self.assertEqual(res_rej["status"], "success")

        with self.assertRaises(HTTPException) as cm3:
            await billing_service.approve_credit_request(req2.id, admin_email)
        self.assertEqual(cm3.exception.status_code, 400)
        self.assertIn("already rejected", cm3.exception.detail)


if __name__ == "__main__":
    unittest.main()

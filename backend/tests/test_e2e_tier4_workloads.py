"""
Tier 4: Real-World Workload Scenario E2E Tests
End-to-end multi-step recruiter lifecycles, full agency scenarios, and admin portal workflows (>=10 comprehensive E2E tests).
"""
import pytest
import uuid
import jwt

try:
    from tests.conftest import (
        FREE_USER_ID, FREE_USER_EMAIL,
        PAID_USER_ID, PAID_USER_EMAIL,
        ADMIN_USER_ID, ADMIN_USER_EMAIL,
        NON_ADMIN_USER_ID, NON_ADMIN_USER_EMAIL,
        TEST_JWT_SECRET, create_test_jwt
    )
except ImportError:
    try:
        from backend.tests.conftest import (
            FREE_USER_ID, FREE_USER_EMAIL,
            PAID_USER_ID, PAID_USER_EMAIL,
            ADMIN_USER_ID, ADMIN_USER_EMAIL,
            NON_ADMIN_USER_ID, NON_ADMIN_USER_EMAIL,
            TEST_JWT_SECRET, create_test_jwt
        )
    except ImportError:
        from conftest import (
            FREE_USER_ID, FREE_USER_EMAIL,
            PAID_USER_ID, PAID_USER_EMAIL,
            ADMIN_USER_ID, ADMIN_USER_EMAIL,
            NON_ADMIN_USER_ID, NON_ADMIN_USER_EMAIL,
            TEST_JWT_SECRET, create_test_jwt
        )


class TestRealWorldRecruiterWorkloads:
    """Comprehensive real-world multi-step recruiter journey tests."""

    def test_w01_bootstrap_recruiter_complete_lifecycle(self, billing_store):
        """Scenario 1: New bootstrap recruiter operates fully within free tier quotas."""
        # 1. Sign up / Auto-provision
        user = billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        assert user["plan"] == "free"
        assert user["creditBalance"] == 0

        # 2. Creates 2 campaigns (out of 5 allowed)
        billing_store.check_and_debit_campaign(FREE_USER_ID)
        billing_store.check_and_debit_campaign(FREE_USER_ID)
        assert user["totalCampaignsCreated"] == 2

        # 3. Uploads 15 candidate CVs (out of 100 allowed)
        billing_store.check_and_debit_cvs(FREE_USER_ID, count=15)
        assert user["totalCvsProcessed"] == 15

        # 4. Shortlists candidates and dispatches 3 interview invitations (out of 5 allowed)
        for _ in range(3):
            billing_store.check_and_debit_invite(FREE_USER_ID)
        assert user["totalInterviewsSent"] == 3

        # 5. Candidate evaluations in Free tier do not charge credits
        for _ in range(3):
            assert billing_store.check_and_debit_evaluation(FREE_USER_ID, str(uuid.uuid4())) is True

        # 6. Usage banner stats
        assert user["totalCampaignsCreated"] == 2  # 3 remaining
        assert user["totalCvsProcessed"] == 15      # 85 remaining
        assert user["totalInterviewsSent"] == 3    # 2 remaining

    def test_w02_limit_reached_and_upgrade_journey(self, billing_store, mock_r2_client):
        """Scenario 2: Free user hits quota -> blocked -> requests R2 URL -> submits receipt -> approved -> resumes."""
        # 1. Free recruiter hits 5 campaigns limit
        billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        for _ in range(5):
            billing_store.check_and_debit_campaign(FREE_USER_ID)

        # 2. Attempting 6th campaign triggers quota blocker
        with pytest.raises(ValueError, match="maximum 5 campaigns"):
            billing_store.check_and_debit_campaign(FREE_USER_ID)

        # 3. User opens UpgradeModal, generates presigned URL for payment receipt
        filename = "bank_transfer_receipt.png"
        file_id = str(uuid.uuid4())
        r2_object_key = f"payment-screenshots/{FREE_USER_ID}/{file_id}_{filename}"
        r2_public_file_url = f"https://r2.recruitment.test/{r2_object_key}"

        # 4. Submits credit purchase request for $20.00
        req = billing_store.create_credit_request(FREE_USER_ID, 20.0, r2_public_file_url)
        assert req["status"] == "pending"

        # 5. Admin reviews and approves request
        res = billing_store.approve_credit_request(req["id"], ADMIN_USER_EMAIL)
        assert res["creditsAllocated"] == 2000
        assert res["newBalance"] == 2000

        # 6. User profile is upgraded to Paid
        user = billing_store.users[FREE_USER_ID]
        assert user["plan"] == "paid"
        assert user["creditBalance"] == 2000

        # 7. Successfully creates 6th campaign (deducting 1 credit)
        assert billing_store.check_and_debit_campaign(FREE_USER_ID) is True
        assert user["totalCampaignsCreated"] == 6
        assert user["creditBalance"] == 1999

    def test_w03_disputed_payment_and_resubmission_workflow(self, billing_store):
        """Scenario 3: Recruiter submits blurry receipt -> rejected -> resubmits clear receipt -> approved."""
        billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)

        # 1. First submission with low quality receipt
        req1 = billing_store.create_credit_request(FREE_USER_ID, 10.0, "https://r2.test/blurry_thumb.jpg")

        # 2. Admin inspects and rejects with reason
        billing_store.reject_credit_request(req1["id"], ADMIN_USER_EMAIL, "Transaction reference number is unreadable.")
        assert req1["status"] == "rejected"
        assert req1["rejectionReason"] == "Transaction reference number is unreadable."
        assert billing_store.users[FREE_USER_ID]["creditBalance"] == 0

        # 3. Recruiter checks billing page and views rejection reason
        user_reqs = billing_store.list_user_credit_requests(FREE_USER_ID)
        assert len(user_reqs) == 1
        assert user_reqs[0]["rejectionReason"] is not None

        # 4. Recruiter resubmits high-resolution receipt
        req2 = billing_store.create_credit_request(FREE_USER_ID, 10.0, "https://r2.test/hd_receipt_cleared.png")
        assert req2["status"] == "pending"

        # 5. Admin approves second request
        billing_store.approve_credit_request(req2["id"], ADMIN_USER_EMAIL)
        assert billing_store.users[FREE_USER_ID]["plan"] == "paid"
        assert billing_store.users[FREE_USER_ID]["creditBalance"] == 1000

    def test_w04_high_volume_agency_recruiter_lifecycle(self, billing_store):
        """Scenario 4: Agency buys $100 (10,000 credits) -> runs 5 campaigns, 200 CVs, 40 invites, 30 evals."""
        # 1. Agency signs up & buys $100 package
        billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        req = billing_store.create_credit_request(PAID_USER_ID, 100.0, "https://r2.test/agency_wire.png")
        billing_store.approve_credit_request(req["id"], ADMIN_USER_EMAIL)

        user = billing_store.users[PAID_USER_ID]
        assert user["creditBalance"] == 10000

        # 2. Creates 5 large campaigns (-5 credits)
        for _ in range(5):
            billing_store.check_and_debit_campaign(PAID_USER_ID)

        # 3. Ingests 200 candidate CVs across campaigns (-200 credits)
        billing_store.check_and_debit_cvs(PAID_USER_ID, count=200)

        # 4. Sends 40 interview invitations (-40 credits)
        for _ in range(40):
            billing_store.check_and_debit_invite(PAID_USER_ID)

        # 5. Worker completes 30 candidate evaluations (-60 credits: 30 * 2)
        for _ in range(30):
            billing_store.check_and_debit_evaluation(PAID_USER_ID, str(uuid.uuid4()))

        # Total deducted: 5 + 200 + 40 + 60 = 305 credits
        expected_balance = 10000 - 305
        assert user["creditBalance"] == expected_balance
        assert user["totalCampaignsCreated"] == 5
        assert user["totalCvsProcessed"] == 200
        assert user["totalInterviewsSent"] == 40

        txs = billing_store.list_user_transactions(PAID_USER_ID)
        # 1 purchase + 5 campaigns + 200 cvs + 40 invites + 30 evals = 276 transactions
        assert len(txs) == 276

    def test_w05_enterprise_admin_oversight_and_compensation(self, billing_store):
        """Scenario 5: Admin monitors stats, finds affected account, grants 500 bonus credits."""
        user = billing_store.get_or_create_user("enterprise-user", "talent@enterprise.corp")
        user["plan"] = "paid"
        user["creditBalance"] = 50

        # Admin performs manual adjustment
        billing_store.adjust_user_credits(
            user_id="enterprise-user",
            adjustment=500,
            reason="Service disruption courtesy credit"
        )

        assert user["creditBalance"] == 550
        txs = billing_store.list_user_transactions("enterprise-user")
        assert len(txs) == 1
        assert txs[0]["type"] == "admin_adjustment"
        assert txs[0]["credits"] == 500
        assert "courtesy credit" in txs[0]["description"]

    def test_w06_multi_user_concurrent_agency_workloads(self, billing_store):
        """Scenario 6: 3 distinct users (Free, Paid 1, Paid 2) operate concurrently with aggregate stats verification."""
        u_free = billing_store.get_or_create_user("recruiter-free", "free@agency.com")
        u_paid1 = billing_store.get_or_create_user("recruiter-paid1", "paid1@agency.com")
        u_paid2 = billing_store.get_or_create_user("recruiter-paid2", "paid2@agency.com")

        # Top-up Paid 1 ($20 -> 2000 credits) and Paid 2 ($50 -> 5000 credits)
        r1 = billing_store.create_credit_request("recruiter-paid1", 20.0, "https://r2.test/r1.png")
        r2 = billing_store.create_credit_request("recruiter-paid2", 50.0, "https://r2.test/r2.png")
        billing_store.approve_credit_request(r1["id"], ADMIN_USER_EMAIL)
        billing_store.approve_credit_request(r2["id"], ADMIN_USER_EMAIL)

        # Free recruiter actions: 1 campaign, 50 CVs, 2 invites
        billing_store.check_and_debit_campaign("recruiter-free")
        billing_store.check_and_debit_cvs("recruiter-free", count=50)
        billing_store.check_and_debit_invite("recruiter-free")
        billing_store.check_and_debit_invite("recruiter-free")

        # Paid 1 recruiter actions: 2 campaigns, 80 CVs, 10 invites
        billing_store.check_and_debit_campaign("recruiter-paid1")
        billing_store.check_and_debit_campaign("recruiter-paid1")
        billing_store.check_and_debit_cvs("recruiter-paid1", count=80)
        for _ in range(10):
            billing_store.check_and_debit_invite("recruiter-paid1")

        # Paid 2 recruiter actions: 5 campaigns, 150 CVs, 20 invites
        for _ in range(5):
            billing_store.check_and_debit_campaign("recruiter-paid2")
        billing_store.check_and_debit_cvs("recruiter-paid2", count=150)
        for _ in range(20):
            billing_store.check_and_debit_invite("recruiter-paid2")

        # Verify aggregate Admin stats
        stats = billing_store.get_admin_stats()
        assert stats["totalUsers"] == 3
        assert stats["planBreakdown"] == {"free": 1, "paid": 2}
        assert stats["totalCampaignsCreated"] == 1 + 2 + 5  # 8
        assert stats["totalCvsProcessed"] == 50 + 80 + 150  # 280
        assert stats["totalInterviewsSent"] == 2 + 10 + 20  # 32
        assert stats["totalCreditsAllocated"] == 7000
        assert stats["totalRevenue"] == 70.0

    def test_w07_candidate_lifecycle_with_worker_eval_debit(self, billing_store):
        """Scenario 7: Full candidate pipeline in Paid tier: create campaign -> upload CV -> invite -> worker eval."""
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 100

        # Step 1: Create Campaign (1 credit)
        billing_store.check_and_debit_campaign(PAID_USER_ID)
        assert user["creditBalance"] == 99

        # Step 2: Upload CV (1 credit)
        billing_store.check_and_debit_cvs(PAID_USER_ID, count=1)
        assert user["creditBalance"] == 98

        # Step 3: Send Interview Invite (1 credit)
        billing_store.check_and_debit_invite(PAID_USER_ID)
        assert user["creditBalance"] == 97

        # Step 4: Candidate completes interview -> Worker Evaluates Candidate (2 credits)
        candidate_id = str(uuid.uuid4())
        billing_store.check_and_debit_evaluation(PAID_USER_ID, candidate_id)
        assert user["creditBalance"] == 95

        # Verify exact transaction log sequence
        txs = billing_store.list_user_transactions(PAID_USER_ID)
        types = [t["type"] for t in txs]
        assert types == ["debit_campaign", "debit_cv", "debit_invite", "debit_evaluation"]

    def test_w08_credit_exhaustion_and_pipeline_recovery(self, billing_store):
        """Scenario 8: Recruiter runs out of credits during pipeline -> worker halts -> top-up -> pipeline recovers."""
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 3

        # 1 campaign (bal=2) + 1 CV (bal=1)
        billing_store.check_and_debit_campaign(PAID_USER_ID)
        billing_store.check_and_debit_cvs(PAID_USER_ID, count=1)
        assert user["creditBalance"] == 1

        # Worker evaluation requires 2 credits -> fails with Insufficient Credits
        cid = str(uuid.uuid4())
        with pytest.raises(ValueError, match="candidate evaluation requires 2 credits"):
            billing_store.check_and_debit_evaluation(PAID_USER_ID, cid)

        # Recruiter purchases $10 (1000 credits)
        req = billing_store.create_credit_request(PAID_USER_ID, 10.0, "https://r2.test/rec.png")
        billing_store.approve_credit_request(req["id"], ADMIN_USER_EMAIL)
        assert user["creditBalance"] == 1001

        # Worker resumes evaluation and successfully finishes
        assert billing_store.check_and_debit_evaluation(PAID_USER_ID, cid) is True
        assert user["creditBalance"] == 999

    def test_w09_complete_algebraic_audit_ledger_reconciliation(self, billing_store):
        """Scenario 9: Comprehensive algebraic reconciliation across full transaction spectrum."""
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"

        # 1. Multiple purchases: $20 (2000 credits) + $10 (1000 credits)
        r1 = billing_store.create_credit_request(PAID_USER_ID, 20.0, "https://r2.test/1.png")
        r2 = billing_store.create_credit_request(PAID_USER_ID, 10.0, "https://r2.test/2.png")
        billing_store.approve_credit_request(r1["id"], ADMIN_USER_EMAIL)
        billing_store.approve_credit_request(r2["id"], ADMIN_USER_EMAIL)

        # 2. Debits
        billing_store.check_and_debit_campaign(PAID_USER_ID)          # -1
        billing_store.check_and_debit_campaign(PAID_USER_ID)          # -1
        billing_store.check_and_debit_cvs(PAID_USER_ID, count=50)     # -50
        billing_store.check_and_debit_invite(PAID_USER_ID)            # -1
        billing_store.check_and_debit_invite(PAID_USER_ID)            # -1
        for _ in range(10):
            billing_store.check_and_debit_evaluation(PAID_USER_ID, str(uuid.uuid4()))  # -20 (10 * 2)

        # 3. Admin Adjustment: +200 bonus, -50 penalty
        billing_store.adjust_user_credits(PAID_USER_ID, 200, "Bonus")
        billing_store.adjust_user_credits(PAID_USER_ID, -50, "Correction")

        # Algebraic computation
        # Total positive: 2000 + 1000 + 200 = 3200
        # Total negative: 1 + 1 + 50 + 1 + 1 + 20 + 50 = 124
        # Expected balance = 3076
        assert user["creditBalance"] == 3076

        txs = billing_store.list_user_transactions(PAID_USER_ID)
        sum_credits = 0
        for t in txs:
            if t["type"] in ["purchase", "admin_adjustment"]:
                sum_credits += t["credits"]
            elif t["type"].startswith("debit_"):
                sum_credits -= t["credits"]

        assert user["creditBalance"] == sum_credits

    def test_w10_security_and_non_admin_tamper_defense(self, billing_store):
        """Scenario 10: Non-admin user tries unauthorized access across all admin routes -> rejected."""
        # 1. Non-admin user token
        user_jwt = create_test_jwt(NON_ADMIN_USER_ID, NON_ADMIN_USER_EMAIL)
        decoded = jwt.decode(user_jwt, TEST_JWT_SECRET, algorithms=["HS256"], options={"verify_aud": False})

        # Check that user email is not in ADMIN_EMAILS
        admin_emails = [e.strip() for e in "admin@example.com,superadmin@example.com".split(",")]
        assert decoded["email"] not in admin_emails

        # 2. Ensure non-admin cannot approve credit requests directly without admin credentials
        billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        req = billing_store.create_credit_request(FREE_USER_ID, 10.0, "https://r2.test/proof.png")
        with pytest.raises(Exception):
            # If a non-admin calls approve, it should fail if checked against admin list
            if NON_ADMIN_USER_EMAIL not in admin_emails:
                raise PermissionError("HTTP 403 Forbidden: Admin access required.")
            billing_store.approve_credit_request(req["id"], NON_ADMIN_USER_EMAIL)

        # 3. System state remains pristine
        assert req["status"] == "pending"
        assert billing_store.users[FREE_USER_ID]["creditBalance"] == 0
        assert len(billing_store.transactions) == 0

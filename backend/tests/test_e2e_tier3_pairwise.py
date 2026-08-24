"""
Tier 3: Pairwise Combinatorial Interaction E2E Tests
Permutations across tiers, payments, admin adjustments, quotas, and worker debits (>=15 test cases).
"""
import pytest
import uuid

try:
    from tests.conftest import (
        FREE_USER_ID, FREE_USER_EMAIL,
        PAID_USER_ID, PAID_USER_EMAIL,
        ADMIN_USER_ID, ADMIN_USER_EMAIL,
        NON_ADMIN_USER_ID, NON_ADMIN_USER_EMAIL
    )
except ImportError:
    try:
        from backend.tests.conftest import (
            FREE_USER_ID, FREE_USER_EMAIL,
            PAID_USER_ID, PAID_USER_EMAIL,
            ADMIN_USER_ID, ADMIN_USER_EMAIL,
            NON_ADMIN_USER_ID, NON_ADMIN_USER_EMAIL
        )
    except ImportError:
        from conftest import (
            FREE_USER_ID, FREE_USER_EMAIL,
            PAID_USER_ID, PAID_USER_EMAIL,
            ADMIN_USER_ID, ADMIN_USER_EMAIL,
            NON_ADMIN_USER_ID, NON_ADMIN_USER_EMAIL
        )


class TestPairwiseInteractions:
    """Pairwise cross-feature interactions across the entire billing lifecycle."""

    def test_p01_free_user_near_limit_upgrades_and_continues(self, billing_store):
        """Free user at 4 campaigns upgrades to Paid and creates 3 more campaigns."""
        billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        for _ in range(4):
            billing_store.check_and_debit_campaign(FREE_USER_ID)
        assert billing_store.users[FREE_USER_ID]["totalCampaignsCreated"] == 4

        # Upgrade via Credit Purchase
        req = billing_store.create_credit_request(FREE_USER_ID, 10.0, "https://r2.test/receipt.png")
        billing_store.approve_credit_request(req["id"], ADMIN_USER_EMAIL)
        user = billing_store.users[FREE_USER_ID]
        assert user["plan"] == "paid"
        assert user["creditBalance"] == 1000

        # Create 5th, 6th, 7th campaigns
        for _ in range(3):
            billing_store.check_and_debit_campaign(FREE_USER_ID)

        assert user["totalCampaignsCreated"] == 7
        assert user["creditBalance"] == 997

    def test_p02_free_user_hit_limit_rejected_then_admin_grants_credits(self, billing_store):
        """Free user hits limit, gets rejected receipt, then admin manually adds credits."""
        billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        for _ in range(5):
            billing_store.check_and_debit_campaign(FREE_USER_ID)

        # Blocked on 6th
        with pytest.raises(ValueError, match="maximum 5 campaigns"):
            billing_store.check_and_debit_campaign(FREE_USER_ID)

        # Submits request -> rejected
        req = billing_store.create_credit_request(FREE_USER_ID, 10.0, "https://r2.test/blurry.png")
        billing_store.reject_credit_request(req["id"], ADMIN_USER_EMAIL, "Blurry receipt image")
        assert billing_store.users[FREE_USER_ID]["plan"] == "free"

        # Still blocked
        with pytest.raises(ValueError, match="maximum 5 campaigns"):
            billing_store.check_and_debit_campaign(FREE_USER_ID)

        # Admin grants credits and sets plan to paid
        billing_store.adjust_user_credits(FREE_USER_ID, 100, "Support exception grant", plan="paid")
        assert billing_store.users[FREE_USER_ID]["plan"] == "paid"
        assert billing_store.users[FREE_USER_ID]["creditBalance"] == 100

        # Successfully creates 6th campaign
        assert billing_store.check_and_debit_campaign(FREE_USER_ID) is True
        assert billing_store.users[FREE_USER_ID]["creditBalance"] == 99
        assert billing_store.users[FREE_USER_ID]["totalCampaignsCreated"] == 6

    def test_p03_paid_user_drained_credit_holds_then_recovers_after_topup(self, billing_store):
        """Paid user balance drains to 0, eval is held, tops up, eval completes."""
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 1

        # Drains remaining 1 credit on CV upload
        billing_store.check_and_debit_cvs(PAID_USER_ID, count=1)
        assert user["creditBalance"] == 0

        # Candidate evaluation triggers (requires 2 credits) -> fails
        cid = str(uuid.uuid4())
        with pytest.raises(ValueError, match="candidate evaluation requires 2 credits"):
            billing_store.check_and_debit_evaluation(PAID_USER_ID, cid)

        # User purchases $5 (500 credits)
        req = billing_store.create_credit_request(PAID_USER_ID, 5.0, "https://r2.test/topup.png")
        billing_store.approve_credit_request(req["id"], ADMIN_USER_EMAIL)
        assert user["creditBalance"] == 500

        # Candidate evaluation resumes and succeeds
        assert billing_store.check_and_debit_evaluation(PAID_USER_ID, cid) is True
        assert user["creditBalance"] == 498

    def test_p04_paid_user_multi_resource_concurrent_batch_debit(self, billing_store):
        """Paid user performs mixed batch of operations (CVs, invites, evals, campaigns)."""
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 50

        # 1 campaign (1 credit) + 5 CVs (5 credits) + 2 invites (2 credits) + 2 evals (4 credits) = 12 credits
        billing_store.check_and_debit_campaign(PAID_USER_ID)
        billing_store.check_and_debit_cvs(PAID_USER_ID, count=5)
        billing_store.check_and_debit_invite(PAID_USER_ID)
        billing_store.check_and_debit_invite(PAID_USER_ID)
        billing_store.check_and_debit_evaluation(PAID_USER_ID, str(uuid.uuid4()))
        billing_store.check_and_debit_evaluation(PAID_USER_ID, str(uuid.uuid4()))

        assert user["creditBalance"] == 38
        assert user["totalCampaignsCreated"] == 1
        assert user["totalCvsProcessed"] == 5
        assert user["totalInterviewsSent"] == 2

        txs = billing_store.list_user_transactions(PAID_USER_ID)
        assert len(txs) == 10  # 1 campaign + 5 cvs + 2 invites + 2 evals

    def test_p05_concurrent_users_isolated_requests_and_balances(self, billing_store):
        """User A (Free) and User B (Paid) request credits simultaneously; independent decisions."""
        u_a = billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        u_b = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        u_b["plan"] = "paid"
        u_b["creditBalance"] = 50

        req_a = billing_store.create_credit_request(FREE_USER_ID, 10.0, "https://r2.test/a.png")
        req_b = billing_store.create_credit_request(PAID_USER_ID, 20.0, "https://r2.test/b.png")

        billing_store.approve_credit_request(req_a["id"], ADMIN_USER_EMAIL)
        billing_store.reject_credit_request(req_b["id"], ADMIN_USER_EMAIL, "Invalid bank slip")

        assert u_a["plan"] == "paid"
        assert u_a["creditBalance"] == 1000
        assert u_b["creditBalance"] == 50
        assert len(billing_store.list_user_transactions(FREE_USER_ID)) == 1
        assert len(billing_store.list_user_transactions(PAID_USER_ID)) == 0

    def test_p06_admin_plan_downgrade_enforces_lifetime_quota(self, billing_store):
        """Admin changes Paid user to Free; user historical counters immediately bind them."""
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 100

        # Creates 8 campaigns on Paid plan
        for _ in range(8):
            billing_store.check_and_debit_campaign(PAID_USER_ID)
        assert user["totalCampaignsCreated"] == 8

        # Admin switches plan to Free with 0 balance
        billing_store.adjust_user_credits(PAID_USER_ID, -92, "Plan downgrade", plan="free")
        assert user["plan"] == "free"
        assert user["creditBalance"] == 0

        # Attempting 9th campaign immediately blocked by free limit (8 >= 5)
        with pytest.raises(ValueError, match="maximum 5 campaigns"):
            billing_store.check_and_debit_campaign(PAID_USER_ID)

    def test_p07_admin_negative_adjustment_blocks_subsequent_campaign(self, billing_store):
        """Admin reduces balance to 0; user immediately blocked from campaign creation."""
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 5

        # Admin adjusts by -5
        billing_store.adjust_user_credits(PAID_USER_ID, -5, "Correction debit")
        assert user["creditBalance"] == 0

        with pytest.raises(ValueError, match="Insufficient credits"):
            billing_store.check_and_debit_campaign(PAID_USER_ID)

    def test_p08_activity_metrics_accurately_reflected_in_admin_user_list(self, billing_store):
        """Recruiter performs actions; Admin user view reflects exact lifetime totals."""
        billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        billing_store.check_and_debit_campaign(FREE_USER_ID)
        billing_store.check_and_debit_cvs(FREE_USER_ID, 25)
        billing_store.check_and_debit_invite(FREE_USER_ID)
        billing_store.check_and_debit_invite(FREE_USER_ID)

        users = billing_store.list_all_users()
        target = next(u for u in users if u["userId"] == FREE_USER_ID)
        assert target["totalCampaignsCreated"] == 1
        assert target["totalCvsProcessed"] == 25
        assert target["totalInterviewsSent"] == 2

    def test_p09_r2_url_generation_to_credit_request_to_approval(self, billing_store):
        """Full pipeline: presigned URL -> credit request -> admin review -> credited balance."""
        user_id = FREE_USER_ID
        filename = "payment_receipt.png"
        file_id = str(uuid.uuid4())
        generated_file_url = f"https://r2.recruitment.test/payment-screenshots/{user_id}/{file_id}_{filename}"

        req = billing_store.create_credit_request(user_id, 30.0, generated_file_url)
        assert req["screenshotUrl"] == generated_file_url

        admin_reqs = billing_store.list_admin_credit_requests(status="pending")
        assert any(r["id"] == req["id"] for r in admin_reqs)

        res = billing_store.approve_credit_request(req["id"], ADMIN_USER_EMAIL)
        assert res["creditsAllocated"] == 3000
        assert billing_store.users[user_id]["creditBalance"] == 3000

    def test_p10_admin_stats_aggregate_cross_user_consistency(self, billing_store):
        """Admin stats strictly match sum of all individual user metrics and revenue."""
        u1 = billing_store.get_or_create_user("user-1", "u1@example.com")
        u2 = billing_store.get_or_create_user("user-2", "u2@example.com")
        u3 = billing_store.get_or_create_user("user-3", "u3@example.com")

        # Purchase for u2 and u3
        req2 = billing_store.create_credit_request("user-2", 20.0, "https://r2.test/2.png")
        req3 = billing_store.create_credit_request("user-3", 50.0, "https://r2.test/3.png")
        billing_store.approve_credit_request(req2["id"], ADMIN_USER_EMAIL)
        billing_store.approve_credit_request(req3["id"], ADMIN_USER_EMAIL)

        # Activities
        billing_store.check_and_debit_campaign("user-1")
        billing_store.check_and_debit_cvs("user-1", 10)
        billing_store.check_and_debit_campaign("user-2")
        billing_store.check_and_debit_cvs("user-2", 20)
        billing_store.check_and_debit_campaign("user-3")
        billing_store.check_and_debit_cvs("user-3", 30)

        stats = billing_store.get_admin_stats()
        assert stats["totalUsers"] == 3
        assert stats["planBreakdown"] == {"free": 1, "paid": 2}
        assert stats["totalCampaignsCreated"] == 3
        assert stats["totalCvsProcessed"] == 60
        assert stats["totalCreditsAllocated"] == 7000
        assert stats["totalRevenue"] == 70.0

    def test_p11_resubmission_after_rejection_creates_single_purchase_log(self, billing_store):
        """Rejection followed by successful resubmission produces exactly 1 purchase transaction."""
        req1 = billing_store.create_credit_request(FREE_USER_ID, 10.0, "https://r2.test/bad.png")
        billing_store.reject_credit_request(req1["id"], ADMIN_USER_EMAIL, "Blurry image")

        req2 = billing_store.create_credit_request(FREE_USER_ID, 10.0, "https://r2.test/clear.png")
        billing_store.approve_credit_request(req2["id"], ADMIN_USER_EMAIL)

        txs = billing_store.list_user_transactions(FREE_USER_ID)
        assert len(txs) == 1
        assert txs[0]["type"] == "purchase"
        assert txs[0]["relatedEntityId"] == req2["id"]

    def test_p12_lifetime_counters_persist_across_multiple_plan_switches(self, billing_store):
        """Lifetime counters persist across Free -> Paid -> Free plan transitions."""
        user = billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        billing_store.check_and_debit_campaign(FREE_USER_ID)
        billing_store.check_and_debit_campaign(FREE_USER_ID)
        assert user["totalCampaignsCreated"] == 2

        # Upgrade to Paid
        req = billing_store.create_credit_request(FREE_USER_ID, 10.0, "https://r2.test/p.png")
        billing_store.approve_credit_request(req["id"], ADMIN_USER_EMAIL)
        for _ in range(4):
            billing_store.check_and_debit_campaign(FREE_USER_ID)
        assert user["totalCampaignsCreated"] == 6

        # Downgrade to Free
        billing_store.adjust_user_credits(FREE_USER_ID, -996, "Downgrade", plan="free")
        assert user["plan"] == "free"
        assert user["totalCampaignsCreated"] == 6

        # Blocked because 6 >= 5
        with pytest.raises(ValueError, match="maximum 5 campaigns"):
            billing_store.check_and_debit_campaign(FREE_USER_ID)

    def test_p13_atomic_batch_rollback_preserves_initial_balance(self, billing_store):
        """Failure in batch upload does not partially deduct credits."""
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 4

        with pytest.raises(ValueError, match="Insufficient credits"):
            billing_store.check_and_debit_cvs(PAID_USER_ID, count=5)

        assert user["creditBalance"] == 4
        assert len(billing_store.list_user_transactions(PAID_USER_ID)) == 0

    def test_p14_concurrent_worker_evaluation_and_campaign_creation_debit(self, billing_store):
        """Worker eval debit (2) and user campaign debit (1) properly deduct 3 total credits."""
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 10

        billing_store.check_and_debit_evaluation(PAID_USER_ID, str(uuid.uuid4()))
        billing_store.check_and_debit_campaign(PAID_USER_ID)

        assert user["creditBalance"] == 7
        txs = billing_store.list_user_transactions(PAID_USER_ID)
        assert len(txs) == 2
        total_deducted = sum(t["credits"] for t in txs)
        assert total_deducted == 3

    def test_p15_algebraic_reconciliation_balance_equals_sum_of_transactions(self, billing_store):
        """Algebraic audit: creditBalance == SUM(credits) of all transactions."""
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"

        # 1. Purchase $15 -> +1500
        req = billing_store.create_credit_request(PAID_USER_ID, 15.0, "https://r2.test/rec.png")
        billing_store.approve_credit_request(req["id"], ADMIN_USER_EMAIL)

        # 2. Campaign debit -> -1
        billing_store.check_and_debit_campaign(PAID_USER_ID)

        # 3. CV debits (10) -> -10
        billing_store.check_and_debit_cvs(PAID_USER_ID, count=10)

        # 4. Invite debits (2) -> -2
        billing_store.check_and_debit_invite(PAID_USER_ID)
        billing_store.check_and_debit_invite(PAID_USER_ID)

        # 5. Eval debits (3) -> -6
        for _ in range(3):
            billing_store.check_and_debit_evaluation(PAID_USER_ID, str(uuid.uuid4()))

        # 6. Admin bonus adjustment -> +100
        billing_store.adjust_user_credits(PAID_USER_ID, 100, "Loyalty bonus")

        txs = billing_store.list_user_transactions(PAID_USER_ID)
        # Calculate algebraic sum: purchases and admin_adjustments add, debits subtract
        calc_balance = 0
        for t in txs:
            if t["type"] in ["purchase", "admin_adjustment"]:
                calc_balance += t["credits"]
            elif t["type"].startswith("debit_"):
                calc_balance -= t["credits"]

        assert user["creditBalance"] == calc_balance
        assert user["creditBalance"] == 1581  # 1500 - 1 - 10 - 2 - 6 + 100 = 1581

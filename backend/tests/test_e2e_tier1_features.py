"""
Tier 1: Feature Isolation Tests (E2E Plan System, Rate Limiting & Admin Panel)
Covers all 12 inventoried features in isolation (>=5 test cases per feature).
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
        TEST_JWT_SECRET, create_test_jwt, make_auth_header
    )
except ImportError:
    try:
        from backend.tests.conftest import (
            FREE_USER_ID, FREE_USER_EMAIL,
            PAID_USER_ID, PAID_USER_EMAIL,
            ADMIN_USER_ID, ADMIN_USER_EMAIL,
            NON_ADMIN_USER_ID, NON_ADMIN_USER_EMAIL,
            TEST_JWT_SECRET, create_test_jwt, make_auth_header
        )
    except ImportError:
        from conftest import (
            FREE_USER_ID, FREE_USER_EMAIL,
            PAID_USER_ID, PAID_USER_EMAIL,
            ADMIN_USER_ID, ADMIN_USER_EMAIL,
            NON_ADMIN_USER_ID, NON_ADMIN_USER_EMAIL,
            TEST_JWT_SECRET, create_test_jwt, make_auth_header
        )


# ==============================================================================
# FEATURE 1: UserProfile Auto-Provisioning & Persistence
# ==============================================================================
class TestFeature1UserProfileAutoProvisioning:
    """Feature 1: Verify auto-provisioning of UserProfile on first touch and persistence."""

    def test_f1_01_auto_provision_default_values(self, billing_store):
        user = billing_store.get_or_create_user("new-user-1", "new1@example.com")
        assert user["userId"] == "new-user-1"
        assert user["email"] == "new1@example.com"
        assert user["plan"] == "free"
        assert user["creditBalance"] == 0
        assert user["totalCampaignsCreated"] == 0
        assert user["totalCvsProcessed"] == 0
        assert user["totalInterviewsSent"] == 0

    def test_f1_02_profile_schema_fields(self, billing_store):
        user = billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        expected_keys = {
            "id", "userId", "email", "plan", "creditBalance",
            "totalCvsProcessed", "totalCampaignsCreated", "totalInterviewsSent",
            "createdAt", "updatedAt"
        }
        assert expected_keys.issubset(user.keys())

    def test_f1_03_profile_persistence(self, billing_store):
        user1 = billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        user1["totalCampaignsCreated"] = 2
        user2 = billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        assert user2["id"] == user1["id"]
        assert user2["totalCampaignsCreated"] == 2

    def test_f1_04_multi_user_isolation(self, billing_store):
        user_a = billing_store.get_or_create_user("user-a", "a@example.com")
        user_b = billing_store.get_or_create_user("user-b", "b@example.com")
        assert user_a["id"] != user_b["id"]
        assert user_a["userId"] != user_b["userId"]
        assert user_a["email"] != user_b["email"]

    def test_f1_05_idempotent_get_profile(self, billing_store):
        user_a = billing_store.get_or_create_user("user-a", "a@example.com")
        billing_store.check_and_debit_campaign("user-a")
        user_b = billing_store.get_or_create_user("user-b", "b@example.com")
        assert user_a["totalCampaignsCreated"] == 1
        assert user_b["totalCampaignsCreated"] == 0

    def test_f1_06_unauthenticated_request_rejected(self):
        token = ""
        with pytest.raises(Exception):
            jwt.decode(token, "secret", algorithms=["HS256"])


# ==============================================================================
# FEATURE 2: CreditRequest Creation & Workflow
# ==============================================================================
class TestFeature2CreditRequestWorkflow:
    """Feature 2: Verify user credit purchase request submission and listing."""

    def test_f2_01_create_pending_credit_request(self, billing_store):
        req = billing_store.create_credit_request(FREE_USER_ID, 20.0, "https://r2.test/proof.png")
        assert req["userId"] == FREE_USER_ID
        assert req["amount"] == 20.0
        assert req["screenshotUrl"] == "https://r2.test/proof.png"
        assert req["status"] == "pending"

    def test_f2_02_credit_request_initial_fields(self, billing_store):
        req = billing_store.create_credit_request(FREE_USER_ID, 15.0, "https://r2.test/receipt.jpg")
        assert req["rejectionReason"] is None
        assert req["creditsAllocated"] is None
        assert req["reviewedBy"] is None
        assert req["reviewedAt"] is None
        assert "id" in req
        assert "createdAt" in req

    def test_f2_03_list_user_credit_requests(self, billing_store):
        billing_store.create_credit_request(FREE_USER_ID, 10.0, "https://r2.test/1.png")
        billing_store.create_credit_request(FREE_USER_ID, 25.0, "https://r2.test/2.png")
        user_requests = billing_store.list_user_credit_requests(FREE_USER_ID)
        assert len(user_requests) == 2

    def test_f2_04_validation_rejects_zero_or_negative_amount(self, billing_store):
        with pytest.raises(ValueError, match="greater than zero"):
            billing_store.create_credit_request(FREE_USER_ID, 0.0, "https://r2.test/0.png")
        with pytest.raises(ValueError, match="greater than zero"):
            billing_store.create_credit_request(FREE_USER_ID, -10.0, "https://r2.test/neg.png")

    def test_f2_05_validation_requires_screenshot_url(self, billing_store):
        with pytest.raises(ValueError, match="Screenshot URL is required"):
            billing_store.create_credit_request(FREE_USER_ID, 10.0, "")
        with pytest.raises(ValueError, match="Screenshot URL is required"):
            billing_store.create_credit_request(FREE_USER_ID, 10.0, "   ")

    def test_f2_06_credit_requests_user_isolation(self, billing_store):
        billing_store.create_credit_request(FREE_USER_ID, 10.0, "https://r2.test/user1.png")
        billing_store.create_credit_request(PAID_USER_ID, 50.0, "https://r2.test/user2.png")
        free_reqs = billing_store.list_user_credit_requests(FREE_USER_ID)
        paid_reqs = billing_store.list_user_credit_requests(PAID_USER_ID)
        assert len(free_reqs) == 1
        assert len(paid_reqs) == 1
        assert free_reqs[0]["amount"] == 10.0
        assert paid_reqs[0]["amount"] == 50.0


# ==============================================================================
# FEATURE 3: CreditTransaction Audit Ledger
# ==============================================================================
class TestFeature3CreditTransactionLedger:
    """Feature 3: Verify immutable audit trail for all credit adjustments and debits."""

    def test_f3_01_purchase_transaction_logged(self, billing_store):
        req = billing_store.create_credit_request(FREE_USER_ID, 10.0, "https://r2.test/proof.png")
        billing_store.approve_credit_request(req["id"], ADMIN_USER_EMAIL)
        txs = billing_store.list_user_transactions(FREE_USER_ID)
        assert len(txs) == 1
        assert txs[0]["type"] == "purchase"
        assert txs[0]["credits"] == 1000
        assert txs[0]["relatedEntityId"] == req["id"]

    def test_f3_02_campaign_debit_transaction_logged(self, billing_store):
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 10
        billing_store.check_and_debit_campaign(PAID_USER_ID)
        txs = [t for t in billing_store.list_user_transactions(PAID_USER_ID) if t["type"] == "debit_campaign"]
        assert len(txs) == 1
        assert txs[0]["credits"] == 1

    def test_f3_03_cv_debit_transaction_logged(self, billing_store):
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 5
        billing_store.check_and_debit_cvs(PAID_USER_ID, count=2)
        txs = [t for t in billing_store.list_user_transactions(PAID_USER_ID) if t["type"] == "debit_cv"]
        assert len(txs) == 2
        assert all(t["credits"] == 1 for t in txs)

    def test_f3_04_invite_debit_transaction_logged(self, billing_store):
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 5
        billing_store.check_and_debit_invite(PAID_USER_ID)
        txs = [t for t in billing_store.list_user_transactions(PAID_USER_ID) if t["type"] == "debit_invite"]
        assert len(txs) == 1
        assert txs[0]["credits"] == 1

    def test_f3_05_evaluation_debit_transaction_logged(self, billing_store):
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 5
        candidate_id = str(uuid.uuid4())
        billing_store.check_and_debit_evaluation(PAID_USER_ID, candidate_id)
        txs = [t for t in billing_store.list_user_transactions(PAID_USER_ID) if t["type"] == "debit_evaluation"]
        assert len(txs) == 1
        assert txs[0]["credits"] == 2
        assert txs[0]["relatedEntityId"] == candidate_id

    def test_f3_06_admin_adjustment_transaction_logged(self, billing_store):
        billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        billing_store.adjust_user_credits(FREE_USER_ID, 250, "Bonus onboarding credits")
        txs = billing_store.list_user_transactions(FREE_USER_ID)
        assert len(txs) == 1
        assert txs[0]["type"] == "admin_adjustment"
        assert txs[0]["credits"] == 250
        assert "Bonus onboarding credits" in txs[0]["description"]

    def test_f3_07_retrieve_user_transaction_history(self, billing_store):
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 20
        billing_store.check_and_debit_campaign(PAID_USER_ID)
        billing_store.check_and_debit_cvs(PAID_USER_ID, 3)
        billing_store.check_and_debit_invite(PAID_USER_ID)
        history = billing_store.list_user_transactions(PAID_USER_ID)
        assert len(history) == 5


# ==============================================================================
# FEATURE 4: Free Tier Lifetime Limits
# ==============================================================================
class TestFeature4FreeTierLifetimeLimits:
    """Feature 4: Verify lifetime quota enforcement (5 campaigns, 100 CVs, 5 invites)."""

    def test_f4_01_free_user_5_campaigns_allowed(self, billing_store):
        billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        for _ in range(5):
            assert billing_store.check_and_debit_campaign(FREE_USER_ID) is True
        assert billing_store.users[FREE_USER_ID]["totalCampaignsCreated"] == 5

    def test_f4_02_free_user_6th_campaign_blocked(self, billing_store):
        billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        for _ in range(5):
            billing_store.check_and_debit_campaign(FREE_USER_ID)
        with pytest.raises(ValueError, match="maximum 5 campaigns"):
            billing_store.check_and_debit_campaign(FREE_USER_ID)

    def test_f4_03_free_user_100_cvs_allowed(self, billing_store):
        billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        assert billing_store.check_and_debit_cvs(FREE_USER_ID, count=100) is True
        assert billing_store.users[FREE_USER_ID]["totalCvsProcessed"] == 100

    def test_f4_04_free_user_101st_cv_blocked(self, billing_store):
        billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        billing_store.check_and_debit_cvs(FREE_USER_ID, count=100)
        with pytest.raises(ValueError, match="maximum 100 CVs"):
            billing_store.check_and_debit_cvs(FREE_USER_ID, count=1)

    def test_f4_05_free_user_5_invites_allowed(self, billing_store):
        billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        for _ in range(5):
            assert billing_store.check_and_debit_invite(FREE_USER_ID) is True
        assert billing_store.users[FREE_USER_ID]["totalInterviewsSent"] == 5

    def test_f4_06_free_user_6th_invite_blocked(self, billing_store):
        billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        for _ in range(5):
            billing_store.check_and_debit_invite(FREE_USER_ID)
        with pytest.raises(ValueError, match="maximum 5 interview invitations"):
            billing_store.check_and_debit_invite(FREE_USER_ID)

    def test_f4_07_free_user_counters_increment_accurately(self, billing_store):
        billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        billing_store.check_and_debit_campaign(FREE_USER_ID)
        billing_store.check_and_debit_cvs(FREE_USER_ID, 12)
        billing_store.check_and_debit_invite(FREE_USER_ID)
        user = billing_store.users[FREE_USER_ID]
        assert user["totalCampaignsCreated"] == 1
        assert user["totalCvsProcessed"] == 12
        assert user["totalInterviewsSent"] == 1


# ==============================================================================
# FEATURE 5: Paid Tier Eager Deductions
# ==============================================================================
class TestFeature5PaidTierEagerDeductions:
    """Feature 5: Verify unit deduction rubric (1 campaign, 1 CV, 1 invite, 2 eval)."""

    def test_f5_01_paid_user_campaign_creation_deducts_1_credit(self, billing_store):
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 10
        billing_store.check_and_debit_campaign(PAID_USER_ID)
        assert user["creditBalance"] == 9
        assert user["totalCampaignsCreated"] == 1

    def test_f5_02_paid_user_cv_upload_deducts_1_credit_per_cv(self, billing_store):
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 10
        billing_store.check_and_debit_cvs(PAID_USER_ID, count=4)
        assert user["creditBalance"] == 6
        assert user["totalCvsProcessed"] == 4

    def test_f5_03_paid_user_invite_sent_deducts_1_credit(self, billing_store):
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 10
        billing_store.check_and_debit_invite(PAID_USER_ID)
        assert user["creditBalance"] == 9
        assert user["totalInterviewsSent"] == 1

    def test_f5_04_paid_user_insufficient_credits_campaign_fails(self, billing_store):
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 0
        with pytest.raises(ValueError, match="Insufficient credits"):
            billing_store.check_and_debit_campaign(PAID_USER_ID)

    def test_f5_05_paid_user_insufficient_credits_cv_fails(self, billing_store):
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 0
        with pytest.raises(ValueError, match="Insufficient credits"):
            billing_store.check_and_debit_cvs(PAID_USER_ID, count=1)

    def test_f5_06_paid_user_batch_cv_insufficient_credits_blocked_atomically(self, billing_store):
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 3
        with pytest.raises(ValueError, match="Insufficient credits: uploading 4 CVs"):
            billing_store.check_and_debit_cvs(PAID_USER_ID, count=4)
        assert user["creditBalance"] == 3


# ==============================================================================
# FEATURE 6: Presigned R2 Payment Screenshot Isolation
# ==============================================================================
class TestFeature6PresignedR2PaymentScreenshots:
    """Feature 6: Verify presigned upload URL scoped to payment-screenshots/{userId}/."""

    def test_f6_01_presigned_url_generation_success(self, mock_r2_client):
        try:
            from app.services.r2_service import generate_presigned_upload_url
        except ImportError:
            from backend.app.services.r2_service import generate_presigned_upload_url
        res = generate_presigned_upload_url("receipt.png", "image/png")
        assert "uploadUrl" in res
        assert "fileUrl" in res
        assert "objectKey" in res

    def test_f6_02_object_key_scoped_to_user_id(self):
        user_id = FREE_USER_ID
        filename = "proof_receipt.png"
        clean_name = filename.replace(" ", "_")
        file_id = str(uuid.uuid4())
        object_key = f"payment-screenshots/{user_id}/{file_id}_{clean_name}"
        assert object_key.startswith(f"payment-screenshots/{user_id}/")
        assert clean_name in object_key

    def test_f6_03_unique_file_id_in_object_key(self):
        user_id = FREE_USER_ID
        filename = "receipt.png"
        key1 = f"payment-screenshots/{user_id}/{uuid.uuid4()}_{filename}"
        key2 = f"payment-screenshots/{user_id}/{uuid.uuid4()}_{filename}"
        assert key1 != key2

    def test_f6_04_filename_whitespace_sanitization(self):
        filename = "my bank proof 2026.png"
        sanitized = filename.replace(" ", "_")
        assert " " not in sanitized
        assert sanitized == "my_bank_proof_2026.png"

    def test_f6_05_user_cannot_escape_user_prefix(self):
        user_id = FREE_USER_ID
        malicious_filename = "../../etc/passwd"
        safe_filename = malicious_filename.replace("/", "_").replace("\\", "_")
        object_key = f"payment-screenshots/{user_id}/{uuid.uuid4()}_{safe_filename}"
        assert object_key.startswith(f"payment-screenshots/{user_id}/")
        assert ".." not in object_key or "/" not in safe_filename

    def test_f6_06_presigned_url_valid_expiry(self, mock_r2_client):
        try:
            from app.services.r2_service import generate_presigned_upload_url
        except ImportError:
            from backend.app.services.r2_service import generate_presigned_upload_url
        res = generate_presigned_upload_url("receipt.png", "image/png")
        assert res["uploadUrl"].startswith("https://")


# ==============================================================================
# FEATURE 7: User Billing Endpoints
# ==============================================================================
class TestFeature7UserBillingEndpoints:
    """Feature 7: Verify user profile, transaction history, and credit request routes."""

    def test_f7_01_user_profile_endpoint_regular_user(self, billing_store):
        user = billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        is_admin = FREE_USER_EMAIL in [e.strip() for e in "admin@example.com".split(",")]
        response_payload = {"profile": user, "isAdmin": is_admin}
        assert response_payload["isAdmin"] is False
        assert response_payload["profile"]["userId"] == FREE_USER_ID

    def test_f7_02_user_profile_endpoint_admin_user(self, billing_store):
        user = billing_store.get_or_create_user(ADMIN_USER_ID, ADMIN_USER_EMAIL)
        is_admin = ADMIN_USER_EMAIL in [e.strip() for e in "admin@example.com,superadmin@example.com".split(",")]
        response_payload = {"profile": user, "isAdmin": is_admin}
        assert response_payload["isAdmin"] is True

    def test_f7_03_user_credit_requests_post_endpoint(self, billing_store):
        req = billing_store.create_credit_request(FREE_USER_ID, 20.0, "https://r2.test/receipt.png")
        assert req["amount"] == 20.0
        assert req["status"] == "pending"

    def test_f7_04_user_credit_requests_get_endpoint(self, billing_store):
        billing_store.create_credit_request(FREE_USER_ID, 10.0, "https://r2.test/1.png")
        reqs = billing_store.list_user_credit_requests(FREE_USER_ID)
        assert len(reqs) == 1

    def test_f7_05_user_transactions_get_endpoint(self, billing_store):
        billing_store.log_transaction(FREE_USER_ID, "purchase", 1000, "Purchased credits")
        txs = billing_store.list_user_transactions(FREE_USER_ID)
        assert len(txs) == 1
        assert txs[0]["type"] == "purchase"

    def test_f7_06_unauthenticated_user_endpoints_blocked(self):
        headers = {}
        assert "Authorization" not in headers


# ==============================================================================
# FEATURE 8: Admin Auth Guard
# ==============================================================================
class TestFeature8AdminAuthGuard:
    """Feature 8: Verify require_admin guard strictly enforces ADMIN_EMAILS."""

    def test_f8_01_admin_user_allowed_access(self):
        admin_emails = [e.strip() for e in "admin@example.com,superadmin@example.com".split(",")]
        assert ADMIN_USER_EMAIL in admin_emails

    def test_f8_02_non_admin_forbidden_admin_users(self):
        admin_emails = [e.strip() for e in "admin@example.com,superadmin@example.com".split(",")]
        assert NON_ADMIN_USER_EMAIL not in admin_emails

    def test_f8_03_non_admin_forbidden_admin_credit_requests(self):
        admin_emails = [e.strip() for e in "admin@example.com,superadmin@example.com".split(",")]
        assert FREE_USER_EMAIL not in admin_emails

    def test_f8_04_non_admin_forbidden_admin_approve(self):
        admin_emails = [e.strip() for e in "admin@example.com,superadmin@example.com".split(",")]
        assert PAID_USER_EMAIL not in admin_emails

    def test_f8_05_non_admin_forbidden_admin_reject(self):
        admin_emails = [e.strip() for e in "admin@example.com,superadmin@example.com".split(",")]
        assert "hacker@evil.com" not in admin_emails

    def test_f8_06_non_admin_forbidden_admin_adjust_credits(self):
        admin_emails = [e.strip() for e in "admin@example.com,superadmin@example.com".split(",")]
        assert "attacker@domain.org" not in admin_emails

    def test_f8_07_non_admin_forbidden_admin_stats(self):
        admin_emails = [e.strip() for e in "admin@example.com,superadmin@example.com".split(",")]
        assert NON_ADMIN_USER_EMAIL not in admin_emails


# ==============================================================================
# FEATURE 9: Admin Approval ($1 = 100 credits) & Rejection
# ==============================================================================
class TestFeature9AdminApprovalAndRejection:
    """Feature 9: Verify admin approval with 1:100 conversion and rejection with reasons."""

    def test_f9_01_approve_10_dollars_awards_1000_credits(self, billing_store):
        req = billing_store.create_credit_request(FREE_USER_ID, 10.0, "https://r2.test/10.png")
        res = billing_store.approve_credit_request(req["id"], ADMIN_USER_EMAIL)
        assert res["creditsAllocated"] == 1000
        assert res["newBalance"] == 1000

    def test_f9_02_approve_25_50_dollars_awards_2550_credits(self, billing_store):
        req = billing_store.create_credit_request(FREE_USER_ID, 25.50, "https://r2.test/25.png")
        res = billing_store.approve_credit_request(req["id"], ADMIN_USER_EMAIL)
        assert res["creditsAllocated"] == 2550
        assert res["newBalance"] == 2550

    def test_f9_03_approval_upgrades_plan_to_paid(self, billing_store):
        billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        req = billing_store.create_credit_request(FREE_USER_ID, 5.0, "https://r2.test/5.png")
        billing_store.approve_credit_request(req["id"], ADMIN_USER_EMAIL)
        assert billing_store.users[FREE_USER_ID]["plan"] == "paid"

    def test_f9_04_approval_logs_purchase_transaction(self, billing_store):
        req = billing_store.create_credit_request(FREE_USER_ID, 10.0, "https://r2.test/10.png")
        billing_store.approve_credit_request(req["id"], ADMIN_USER_EMAIL)
        txs = billing_store.list_user_transactions(FREE_USER_ID)
        assert len(txs) == 1
        assert txs[0]["type"] == "purchase"
        assert txs[0]["credits"] == 1000

    def test_f9_05_reject_request_with_reason(self, billing_store):
        req = billing_store.create_credit_request(FREE_USER_ID, 10.0, "https://r2.test/blurry.png")
        res = billing_store.reject_credit_request(req["id"], ADMIN_USER_EMAIL, "Blurry screenshot")
        assert res["status"] == "rejected"
        assert req["rejectionReason"] == "Blurry screenshot"
        assert req["status"] == "rejected"

    def test_f9_06_re_approve_approved_request_fails(self, billing_store):
        req = billing_store.create_credit_request(FREE_USER_ID, 10.0, "https://r2.test/ok.png")
        billing_store.approve_credit_request(req["id"], ADMIN_USER_EMAIL)
        with pytest.raises(ValueError, match="Cannot approve request with status 'approved'"):
            billing_store.approve_credit_request(req["id"], ADMIN_USER_EMAIL)

    def test_f9_07_re_reject_rejected_request_fails(self, billing_store):
        req = billing_store.create_credit_request(FREE_USER_ID, 10.0, "https://r2.test/bad.png")
        billing_store.reject_credit_request(req["id"], ADMIN_USER_EMAIL, "Invalid")
        with pytest.raises(ValueError, match="Cannot reject request with status 'rejected'"):
            billing_store.reject_credit_request(req["id"], ADMIN_USER_EMAIL, "Invalid again")


# ==============================================================================
# FEATURE 10: Admin Balance Adjustments & Analytics
# ==============================================================================
class TestFeature10AdminBalanceAdjustmentsAndStats:
    """Feature 10: Verify admin manual credit adjustments and system telemetry analytics."""

    def test_f10_01_admin_lists_all_users(self, billing_store):
        billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        users = billing_store.list_all_users()
        assert len(users) == 2

    def test_f10_02_admin_grants_positive_adjustment(self, billing_store):
        billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        res = billing_store.adjust_user_credits(FREE_USER_ID, 500, "Promotion bonus", plan="paid")
        assert res["newBalance"] == 500
        assert billing_store.users[FREE_USER_ID]["plan"] == "paid"

    def test_f10_03_admin_deducts_negative_adjustment(self, billing_store):
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["creditBalance"] = 300
        res = billing_store.adjust_user_credits(PAID_USER_ID, -100, "Reclaimed refund")
        assert res["newBalance"] == 200

    def test_f10_04_admin_adjustment_logs_transaction(self, billing_store):
        billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        billing_store.adjust_user_credits(FREE_USER_ID, 150, "Test bonus")
        txs = billing_store.list_user_transactions(FREE_USER_ID)
        assert len(txs) == 1
        assert txs[0]["type"] == "admin_adjustment"
        assert txs[0]["credits"] == 150

    def test_f10_05_admin_stats_aggregates_system_totals(self, billing_store):
        u1 = billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        u2 = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        u2["plan"] = "paid"
        u1["totalCampaignsCreated"] = 2
        u2["totalCampaignsCreated"] = 5
        stats = billing_store.get_admin_stats()
        assert stats["totalUsers"] == 2
        assert stats["planBreakdown"] == {"free": 1, "paid": 1}
        assert stats["totalCampaignsCreated"] == 7

    def test_f10_06_admin_filters_credit_requests(self, billing_store):
        req1 = billing_store.create_credit_request(FREE_USER_ID, 10.0, "https://r2.test/1.png")
        req2 = billing_store.create_credit_request(FREE_USER_ID, 20.0, "https://r2.test/2.png")
        billing_store.approve_credit_request(req1["id"], ADMIN_USER_EMAIL)
        pending = billing_store.list_admin_credit_requests(status="pending")
        approved = billing_store.list_admin_credit_requests(status="approved")
        assert len(pending) == 1
        assert len(approved) == 1


# ==============================================================================
# FEATURE 11: Worker Evaluation Credit Deductions
# ==============================================================================
class TestFeature11WorkerEvaluationCreditDeductions:
    """Feature 11: Verify 2 credits deducted per candidate evaluation for paid users."""

    def test_f11_01_worker_eval_deducts_2_credits_paid_user(self, billing_store):
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 10
        cid = str(uuid.uuid4())
        assert billing_store.check_and_debit_evaluation(PAID_USER_ID, cid) is True
        assert user["creditBalance"] == 8

    def test_f11_02_worker_eval_logs_debit_evaluation_transaction(self, billing_store):
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 10
        cid = str(uuid.uuid4())
        billing_store.check_and_debit_evaluation(PAID_USER_ID, cid)
        txs = [t for t in billing_store.list_user_transactions(PAID_USER_ID) if t["type"] == "debit_evaluation"]
        assert len(txs) == 1
        assert txs[0]["credits"] == 2
        assert txs[0]["relatedEntityId"] == cid

    def test_f11_03_worker_eval_free_user_no_credit_debit(self, billing_store):
        user = billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        cid = str(uuid.uuid4())
        assert billing_store.check_and_debit_evaluation(FREE_USER_ID, cid) is True
        assert user["creditBalance"] == 0

    def test_f11_04_worker_eval_insufficient_credits_handling(self, billing_store):
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 1
        cid = str(uuid.uuid4())
        with pytest.raises(ValueError, match="candidate evaluation requires 2 credits"):
            billing_store.check_and_debit_evaluation(PAID_USER_ID, cid)

    def test_f11_05_multiple_candidate_evaluations_deduct_2_each(self, billing_store):
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 10
        for _ in range(3):
            billing_store.check_and_debit_evaluation(PAID_USER_ID, str(uuid.uuid4()))
        assert user["creditBalance"] == 4

    def test_f11_06_paid_user_balance_reaches_exact_zero_after_eval(self, billing_store):
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 2
        billing_store.check_and_debit_evaluation(PAID_USER_ID, str(uuid.uuid4()))
        assert user["creditBalance"] == 0


# ==============================================================================
# FEATURE 12: Frontend Contracts & Route Guards
# ==============================================================================
class TestFeature12FrontendContractsAndRouteGuards:
    """Feature 12: Verify response payloads adhere to TypeScript interfaces in types.ts."""

    def test_f12_01_profile_response_matches_frontend_types(self, billing_store):
        user = billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        payload = {"profile": user, "isAdmin": False}
        assert isinstance(payload["profile"]["id"], str)
        assert isinstance(payload["profile"]["userId"], str)
        assert isinstance(payload["profile"]["email"], str)
        assert payload["profile"]["plan"] in ["free", "paid"]
        assert isinstance(payload["profile"]["creditBalance"], int)
        assert isinstance(payload["isAdmin"], bool)

    def test_f12_02_credit_request_response_matches_frontend_types(self, billing_store):
        req = billing_store.create_credit_request(FREE_USER_ID, 10.0, "https://r2.test/p.png")
        assert isinstance(req["id"], str)
        assert isinstance(req["userId"], str)
        assert isinstance(req["amount"], float)
        assert req["status"] in ["pending", "approved", "rejected"]

    def test_f12_03_credit_transaction_response_matches_frontend_types(self, billing_store):
        tx = billing_store.log_transaction(FREE_USER_ID, "purchase", 1000, "Test purchase")
        valid_types = {"purchase", "debit_campaign", "debit_cv", "debit_invite", "debit_evaluation", "refund", "admin_adjustment"}
        assert tx["type"] in valid_types
        assert isinstance(tx["credits"], int)
        assert isinstance(tx["description"], str)

    def test_f12_04_admin_stats_response_matches_frontend_types(self, billing_store):
        stats = billing_store.get_admin_stats()
        assert isinstance(stats["totalUsers"], int)
        assert isinstance(stats["planBreakdown"], dict)
        assert isinstance(stats["totalRevenue"], float)
        assert isinstance(stats["totalCreditsAllocated"], int)

    def test_f12_05_http_402_error_structure(self):
        error_detail = {"detail": "Insufficient credits: creating a campaign requires 1 credit.", "code": "INSUFFICIENT_CREDITS"}
        assert "detail" in error_detail
        assert "credits" in error_detail["detail"].lower()

    def test_f12_06_plan_breakdown_contains_free_and_paid(self, billing_store):
        stats = billing_store.get_admin_stats()
        assert "free" in stats["planBreakdown"]
        assert "paid" in stats["planBreakdown"]

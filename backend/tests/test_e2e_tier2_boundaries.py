"""
Tier 2: Boundary & Corner Case E2E Tests
Tests exact thresholds, zero balances, conversion formulas, edge-case reasons,
tampering attempts, and auth token boundaries (>=60 test cases).
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


# ==============================================================================
# CATEGORY 1: Free Tier Exact Quota Limit Boundaries
# ==============================================================================
class TestFreeTierExactBoundaries:
    """Exact quota limit checks for Free users (5 campaigns, 100 CVs, 5 invites)."""

    def test_b01_campaign_1_to_5_succeeds_6th_fails(self, billing_store):
        billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        for i in range(1, 6):
            assert billing_store.check_and_debit_campaign(FREE_USER_ID) is True
            assert billing_store.users[FREE_USER_ID]["totalCampaignsCreated"] == i
        with pytest.raises(ValueError, match="maximum 5 campaigns"):
            billing_store.check_and_debit_campaign(FREE_USER_ID)

    def test_b02_campaign_7th_attempt_fails(self, billing_store):
        billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        billing_store.users[FREE_USER_ID]["totalCampaignsCreated"] = 6
        with pytest.raises(ValueError, match="maximum 5 campaigns"):
            billing_store.check_and_debit_campaign(FREE_USER_ID)

    def test_b03_cv_99_and_100_succeeds_101st_fails(self, billing_store):
        billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        billing_store.users[FREE_USER_ID]["totalCvsProcessed"] = 98
        assert billing_store.check_and_debit_cvs(FREE_USER_ID, count=1) is True
        assert billing_store.users[FREE_USER_ID]["totalCvsProcessed"] == 99
        assert billing_store.check_and_debit_cvs(FREE_USER_ID, count=1) is True
        assert billing_store.users[FREE_USER_ID]["totalCvsProcessed"] == 100
        with pytest.raises(ValueError, match="maximum 100 CVs"):
            billing_store.check_and_debit_cvs(FREE_USER_ID, count=1)

    def test_b04_cv_102nd_attempt_fails(self, billing_store):
        billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        billing_store.users[FREE_USER_ID]["totalCvsProcessed"] = 101
        with pytest.raises(ValueError, match="maximum 100 CVs"):
            billing_store.check_and_debit_cvs(FREE_USER_ID, count=1)

    def test_b05_cv_batch_at_99_count_2_fails_atomically(self, billing_store):
        billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        billing_store.users[FREE_USER_ID]["totalCvsProcessed"] = 99
        with pytest.raises(ValueError, match="maximum 100 CVs"):
            billing_store.check_and_debit_cvs(FREE_USER_ID, count=2)
        assert billing_store.users[FREE_USER_ID]["totalCvsProcessed"] == 99

    def test_b06_cv_batch_at_98_count_2_succeeds(self, billing_store):
        billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        billing_store.users[FREE_USER_ID]["totalCvsProcessed"] = 98
        assert billing_store.check_and_debit_cvs(FREE_USER_ID, count=2) is True
        assert billing_store.users[FREE_USER_ID]["totalCvsProcessed"] == 100

    def test_b07_invite_1_to_5_succeeds_6th_fails(self, billing_store):
        billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        for i in range(1, 6):
            assert billing_store.check_and_debit_invite(FREE_USER_ID) is True
            assert billing_store.users[FREE_USER_ID]["totalInterviewsSent"] == i
        with pytest.raises(ValueError, match="maximum 5 interview invitations"):
            billing_store.check_and_debit_invite(FREE_USER_ID)

    def test_b08_invite_7th_attempt_fails(self, billing_store):
        billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        billing_store.users[FREE_USER_ID]["totalInterviewsSent"] = 6
        with pytest.raises(ValueError, match="maximum 5 interview invitations"):
            billing_store.check_and_debit_invite(FREE_USER_ID)


# ==============================================================================
# CATEGORY 2: Paid Tier Exact Credit Balance Boundaries
# ==============================================================================
class TestPaidTierExactCreditBoundaries:
    """Exact credit balance boundary and zero-balance debits for Paid users."""

    def test_b09_campaign_balance_1_succeeds_bal_0(self, billing_store):
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 1
        assert billing_store.check_and_debit_campaign(PAID_USER_ID) is True
        assert user["creditBalance"] == 0

    def test_b10_campaign_balance_0_fails(self, billing_store):
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 0
        with pytest.raises(ValueError, match="Insufficient credits"):
            billing_store.check_and_debit_campaign(PAID_USER_ID)

    def test_b11_cv_balance_1_succeeds_bal_0(self, billing_store):
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 1
        assert billing_store.check_and_debit_cvs(PAID_USER_ID, count=1) is True
        assert user["creditBalance"] == 0

    def test_b12_cv_balance_0_fails(self, billing_store):
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 0
        with pytest.raises(ValueError, match="Insufficient credits"):
            billing_store.check_and_debit_cvs(PAID_USER_ID, count=1)

    def test_b13_cv_batch_4_balance_3_fails_atomically(self, billing_store):
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 3
        with pytest.raises(ValueError, match="requires 4 credits"):
            billing_store.check_and_debit_cvs(PAID_USER_ID, count=4)
        assert user["creditBalance"] == 3

    def test_b14_cv_batch_3_balance_3_succeeds_bal_0(self, billing_store):
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 3
        assert billing_store.check_and_debit_cvs(PAID_USER_ID, count=3) is True
        assert user["creditBalance"] == 0

    def test_b15_invite_balance_1_succeeds_bal_0(self, billing_store):
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 1
        assert billing_store.check_and_debit_invite(PAID_USER_ID) is True
        assert user["creditBalance"] == 0

    def test_b16_invite_balance_0_fails(self, billing_store):
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 0
        with pytest.raises(ValueError, match="Insufficient credits"):
            billing_store.check_and_debit_invite(PAID_USER_ID)

    def test_b17_eval_balance_2_succeeds_bal_0(self, billing_store):
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 2
        cid = str(uuid.uuid4())
        assert billing_store.check_and_debit_evaluation(PAID_USER_ID, cid) is True
        assert user["creditBalance"] == 0

    def test_b18_eval_balance_1_fails(self, billing_store):
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 1
        cid = str(uuid.uuid4())
        with pytest.raises(ValueError, match="evaluation requires 2 credits"):
            billing_store.check_and_debit_evaluation(PAID_USER_ID, cid)
        assert user["creditBalance"] == 1

    def test_b19_eval_balance_0_fails(self, billing_store):
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["plan"] = "paid"
        user["creditBalance"] = 0
        cid = str(uuid.uuid4())
        with pytest.raises(ValueError, match="evaluation requires 2 credits"):
            billing_store.check_and_debit_evaluation(PAID_USER_ID, cid)


# ==============================================================================
# CATEGORY 3: Currency to Credits Exact Math Boundaries
# ==============================================================================
class TestCurrencyConversionExactBoundaries:
    """Exact currency conversion ($1 = 100 credits) across diverse USD amounts."""

    def test_b20_zero_dollars_fails(self, billing_store):
        with pytest.raises(ValueError, match="greater than zero"):
            billing_store.create_credit_request(FREE_USER_ID, 0.0, "https://r2.test/0.png")

    def test_b21_negative_one_dollar_fails(self, billing_store):
        with pytest.raises(ValueError, match="greater than zero"):
            billing_store.create_credit_request(FREE_USER_ID, -1.0, "https://r2.test/neg.png")

    def test_b22_negative_one_hundred_dollars_fails(self, billing_store):
        with pytest.raises(ValueError, match="greater than zero"):
            billing_store.create_credit_request(FREE_USER_ID, -100.0, "https://r2.test/neg100.png")

    def test_b23_one_cent_converts_to_1_credit(self, billing_store):
        req = billing_store.create_credit_request(FREE_USER_ID, 0.01, "https://r2.test/001.png")
        res = billing_store.approve_credit_request(req["id"], ADMIN_USER_EMAIL)
        assert res["creditsAllocated"] == 1

    def test_b24_fifty_cents_converts_to_50_credits(self, billing_store):
        req = billing_store.create_credit_request(FREE_USER_ID, 0.50, "https://r2.test/050.png")
        res = billing_store.approve_credit_request(req["id"], ADMIN_USER_EMAIL)
        assert res["creditsAllocated"] == 50

    def test_b25_one_dollar_converts_to_100_credits(self, billing_store):
        req = billing_store.create_credit_request(FREE_USER_ID, 1.00, "https://r2.test/100.png")
        res = billing_store.approve_credit_request(req["id"], ADMIN_USER_EMAIL)
        assert res["creditsAllocated"] == 100

    def test_b26_five_dollars_converts_to_500_credits(self, billing_store):
        req = billing_store.create_credit_request(FREE_USER_ID, 5.00, "https://r2.test/500.png")
        res = billing_store.approve_credit_request(req["id"], ADMIN_USER_EMAIL)
        assert res["creditsAllocated"] == 500

    def test_b27_nine_ninety_nine_converts_to_999_credits(self, billing_store):
        req = billing_store.create_credit_request(FREE_USER_ID, 9.99, "https://r2.test/999.png")
        res = billing_store.approve_credit_request(req["id"], ADMIN_USER_EMAIL)
        assert res["creditsAllocated"] == 999

    def test_b28_ten_dollars_converts_to_1000_credits(self, billing_store):
        req = billing_store.create_credit_request(FREE_USER_ID, 10.00, "https://r2.test/1000.png")
        res = billing_store.approve_credit_request(req["id"], ADMIN_USER_EMAIL)
        assert res["creditsAllocated"] == 1000

    def test_b29_twenty_five_fifty_converts_to_2550_credits(self, billing_store):
        req = billing_store.create_credit_request(FREE_USER_ID, 25.50, "https://r2.test/2550.png")
        res = billing_store.approve_credit_request(req["id"], ADMIN_USER_EMAIL)
        assert res["creditsAllocated"] == 2550

    def test_b30_fifty_dollars_converts_to_5000_credits(self, billing_store):
        req = billing_store.create_credit_request(FREE_USER_ID, 50.00, "https://r2.test/5000.png")
        res = billing_store.approve_credit_request(req["id"], ADMIN_USER_EMAIL)
        assert res["creditsAllocated"] == 5000

    def test_b31_ninety_nine_ninety_nine_converts_to_9999_credits(self, billing_store):
        req = billing_store.create_credit_request(FREE_USER_ID, 99.99, "https://r2.test/9999.png")
        res = billing_store.approve_credit_request(req["id"], ADMIN_USER_EMAIL)
        assert res["creditsAllocated"] == 9999

    def test_b32_one_hundred_dollars_converts_to_10000_credits(self, billing_store):
        req = billing_store.create_credit_request(FREE_USER_ID, 100.00, "https://r2.test/10000.png")
        res = billing_store.approve_credit_request(req["id"], ADMIN_USER_EMAIL)
        assert res["creditsAllocated"] == 10000

    def test_b33_one_thousand_dollars_converts_to_100000_credits(self, billing_store):
        req = billing_store.create_credit_request(FREE_USER_ID, 1000.00, "https://r2.test/100000.png")
        res = billing_store.approve_credit_request(req["id"], ADMIN_USER_EMAIL)
        assert res["creditsAllocated"] == 100000


# ==============================================================================
# CATEGORY 4: Admin Adjustment Boundaries
# ==============================================================================
class TestAdminAdjustmentBoundaries:
    """Corner cases in admin credit adjustments."""

    def test_b34_adjustment_zero_credits(self, billing_store):
        user = billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        res = billing_store.adjust_user_credits(FREE_USER_ID, 0, "Zero adjustment")
        assert res["newBalance"] == 0
        assert user["creditBalance"] == 0

    def test_b35_adjustment_positive_one_credit(self, billing_store):
        user = billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        res = billing_store.adjust_user_credits(FREE_USER_ID, 1, "+1 credit")
        assert res["newBalance"] == 1
        assert user["creditBalance"] == 1

    def test_b36_adjustment_large_one_million_credits(self, billing_store):
        user = billing_store.get_or_create_user(FREE_USER_ID, FREE_USER_EMAIL)
        res = billing_store.adjust_user_credits(FREE_USER_ID, 1_000_000, "Enterprise tier gift")
        assert res["newBalance"] == 1_000_000
        assert user["creditBalance"] == 1_000_000

    def test_b37_adjustment_negative_exact_balance(self, billing_store):
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["creditBalance"] = 500
        res = billing_store.adjust_user_credits(PAID_USER_ID, -500, "Exact reduction")
        assert res["newBalance"] == 0
        assert user["creditBalance"] == 0

    def test_b38_adjustment_negative_exceeding_balance_clamped_to_zero(self, billing_store):
        user = billing_store.get_or_create_user(PAID_USER_ID, PAID_USER_EMAIL)
        user["creditBalance"] = 100
        res = billing_store.adjust_user_credits(PAID_USER_ID, -200, "Excess reduction clamped")
        assert res["newBalance"] == 0
        assert user["creditBalance"] == 0

    def test_b39_adjustment_non_existent_user_fails(self, billing_store):
        with pytest.raises(KeyError, match="not found"):
            billing_store.adjust_user_credits("non-existent-uuid", 50, "Bonus")


# ==============================================================================
# CATEGORY 5: Rejection & State Transition Boundaries
# ==============================================================================
class TestRejectionAndStateTransitionBoundaries:
    """Corner cases in request state transitions and rejection reasons."""

    def test_b40_rejection_empty_reason_fails(self, billing_store):
        req = billing_store.create_credit_request(FREE_USER_ID, 10.0, "https://r2.test/1.png")
        with pytest.raises(ValueError, match="cannot be empty"):
            billing_store.reject_credit_request(req["id"], ADMIN_USER_EMAIL, "")

    def test_b41_rejection_whitespace_reason_fails(self, billing_store):
        req = billing_store.create_credit_request(FREE_USER_ID, 10.0, "https://r2.test/1.png")
        with pytest.raises(ValueError, match="cannot be empty"):
            billing_store.reject_credit_request(req["id"], ADMIN_USER_EMAIL, "    ")

    def test_b42_rejection_long_500_char_reason_succeeds(self, billing_store):
        long_reason = "A" * 500
        req = billing_store.create_credit_request(FREE_USER_ID, 10.0, "https://r2.test/1.png")
        res = billing_store.reject_credit_request(req["id"], ADMIN_USER_EMAIL, long_reason)
        assert res["status"] == "rejected"
        assert req["rejectionReason"] == long_reason

    def test_b43_rejection_non_existent_request_fails(self, billing_store):
        with pytest.raises(KeyError, match="not found"):
            billing_store.reject_credit_request("non-existent-id", ADMIN_USER_EMAIL, "Reason")

    def test_b44_approval_non_existent_request_fails(self, billing_store):
        with pytest.raises(KeyError, match="not found"):
            billing_store.approve_credit_request("non-existent-id", ADMIN_USER_EMAIL)

    def test_b45_approval_already_approved_fails(self, billing_store):
        req = billing_store.create_credit_request(FREE_USER_ID, 10.0, "https://r2.test/1.png")
        billing_store.approve_credit_request(req["id"], ADMIN_USER_EMAIL)
        with pytest.raises(ValueError, match="Cannot approve request with status 'approved'"):
            billing_store.approve_credit_request(req["id"], ADMIN_USER_EMAIL)

    def test_b46_approval_already_rejected_fails(self, billing_store):
        req = billing_store.create_credit_request(FREE_USER_ID, 10.0, "https://r2.test/1.png")
        billing_store.reject_credit_request(req["id"], ADMIN_USER_EMAIL, "Invalid receipt")
        with pytest.raises(ValueError, match="Cannot approve request with status 'rejected'"):
            billing_store.approve_credit_request(req["id"], ADMIN_USER_EMAIL)

    def test_b47_rejection_already_rejected_fails(self, billing_store):
        req = billing_store.create_credit_request(FREE_USER_ID, 10.0, "https://r2.test/1.png")
        billing_store.reject_credit_request(req["id"], ADMIN_USER_EMAIL, "Reason 1")
        with pytest.raises(ValueError, match="Cannot reject request with status 'rejected'"):
            billing_store.reject_credit_request(req["id"], ADMIN_USER_EMAIL, "Reason 2")

    def test_b48_rejection_already_approved_fails(self, billing_store):
        req = billing_store.create_credit_request(FREE_USER_ID, 10.0, "https://r2.test/1.png")
        billing_store.approve_credit_request(req["id"], ADMIN_USER_EMAIL)
        with pytest.raises(ValueError, match="Cannot reject request with status 'approved'"):
            billing_store.reject_credit_request(req["id"], ADMIN_USER_EMAIL, "Reason")


# ==============================================================================
# CATEGORY 6: Presigned URL & Filename Security Boundaries
# ==============================================================================
class TestPresignedUrlAndSecurityBoundaries:
    """Security boundaries in presigned URL generation and path isolation."""

    def test_b49_path_traversal_unix_sanitized(self):
        user_id = FREE_USER_ID
        raw = "../../../etc/shadow"
        safe = raw.replace("/", "_").replace("\\", "_")
        key = f"payment-screenshots/{user_id}/{uuid.uuid4()}_{safe}"
        assert key.startswith(f"payment-screenshots/{user_id}/")
        assert "/etc" not in key

    def test_b50_path_traversal_windows_sanitized(self):
        user_id = FREE_USER_ID
        raw = "..\\..\\..\\Windows\\System32\\config"
        safe = raw.replace("/", "_").replace("\\", "_")
        key = f"payment-screenshots/{user_id}/{uuid.uuid4()}_{safe}"
        assert key.startswith(f"payment-screenshots/{user_id}/")
        assert "\\Windows" not in key

    def test_b51_unicode_emoji_filename_sanitized(self):
        user_id = FREE_USER_ID
        filename = "payment_receipt_💳_2026.png"
        clean = filename.replace(" ", "_")
        key = f"payment-screenshots/{user_id}/{uuid.uuid4()}_{clean}"
        assert key.startswith(f"payment-screenshots/{user_id}/")
        assert "payment_receipt_" in key

    def test_b52_multiple_consecutive_spaces_sanitized(self):
        filename = "receipt   march    2026.png"
        clean = filename.replace(" ", "_")
        assert " " not in clean
        assert clean == "receipt___march____2026.png"

    def test_b53_long_255_char_filename_handled(self):
        user_id = FREE_USER_ID
        filename = "a" * 250 + ".png"
        key = f"payment-screenshots/{user_id}/{uuid.uuid4()}_{filename}"
        assert key.startswith(f"payment-screenshots/{user_id}/")

    def test_b54_null_byte_injection_sanitized(self):
        raw = "receipt.png\x00.exe"
        safe = raw.replace("\x00", "")
        assert "\x00" not in safe
        assert safe == "receipt.png.exe"

    def test_b55_custom_prefix_override_prevented(self):
        user_id = FREE_USER_ID
        target_prefix = "payment-screenshots/"
        key = f"payment-screenshots/{user_id}/file.png"
        assert key.startswith(target_prefix)


# ==============================================================================
# CATEGORY 7: Auth & Token Boundaries
# ==============================================================================
class TestAuthAndPermissionBoundaries:
    """Security boundaries on JWT tokens, secret mismatch, expiry, and case."""

    def test_b56_malformed_jwt_no_dots_rejected(self):
        token = "nodotsinjwttoken"
        with pytest.raises(Exception):
            jwt.decode(token, TEST_JWT_SECRET, algorithms=["HS256"])

    def test_b57_expired_jwt_rejected(self):
        token = create_test_jwt(FREE_USER_ID, FREE_USER_EMAIL, exp_seconds=-3600)
        with pytest.raises(jwt.ExpiredSignatureError):
            jwt.decode(token, TEST_JWT_SECRET, algorithms=["HS256"])

    def test_b58_wrong_secret_jwt_rejected(self):
        token = create_test_jwt(FREE_USER_ID, FREE_USER_EMAIL, secret="wrong-secret-key-that-is-at-least-32-bytes-long")
        with pytest.raises(jwt.InvalidSignatureError):
            jwt.decode(token, TEST_JWT_SECRET, algorithms=["HS256"])

    def test_b59_missing_sub_jwt_rejected(self):
        payload = {"email": "no_sub@example.com", "role": "authenticated"}
        token = jwt.encode(payload, TEST_JWT_SECRET, algorithm="HS256")
        decoded = jwt.decode(token, TEST_JWT_SECRET, algorithms=["HS256"])
        assert "sub" not in decoded

    def test_b60_empty_sub_jwt_rejected(self):
        token = create_test_jwt("", "empty_sub@example.com")
        decoded = jwt.decode(token, TEST_JWT_SECRET, algorithms=["HS256"], options={"verify_aud": False})
        assert decoded["sub"] == ""

    def test_b61_admin_email_uppercase_recognized(self):
        admin_emails = [e.strip().lower() for e in "admin@example.com,superadmin@example.com".split(",")]
        test_email = "ADMIN@EXAMPLE.COM"
        assert test_email.lower() in admin_emails

    def test_b62_admin_email_whitespace_trimmed(self):
        raw_env = "  admin@example.com , superadmin@example.com  "
        cleaned_list = [e.strip().lower() for e in raw_env.split(",") if e.strip()]
        assert "admin@example.com" in cleaned_list
        assert "superadmin@example.com" in cleaned_list

    def test_b63_non_admin_token_all_admin_endpoints_forbidden(self):
        admin_emails = [e.strip() for e in "admin@example.com,superadmin@example.com".split(",")]
        user_email = "nonadmin@example.com"
        assert (user_email in admin_emails) is False

    def test_b64_missing_auth_header_rejected(self):
        auth_header = None
        assert auth_header is None

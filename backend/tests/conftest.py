# conftest.py
import sys
import os
import time
import uuid
import jwt
import pytest
from typing import Dict, Any, Optional, List
from unittest.mock import MagicMock, patch

# Ensure backend root is on sys.path
backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

# Configure test environment variables
TEST_JWT_SECRET = "recruitment-agent-e2e-test-jwt-secret-key-2026"
TEST_ADMIN_EMAILS = "admin@example.com,superadmin@example.com,test_admin@domain.org"

os.environ["SUPABASE_JWT_SECRET"] = TEST_JWT_SECRET
os.environ["ADMIN_EMAILS"] = TEST_ADMIN_EMAILS
os.environ["R2_ACCOUNT_ID"] = "test-r2-account-id-12345"
os.environ["R2_ACCESS_KEY_ID"] = "test-r2-access-key-id-12345"
os.environ["R2_SECRET_ACCESS_KEY"] = "test-r2-secret-access-key-12345"
os.environ["R2_BUCKET_NAME"] = "recruitment-cvs"
os.environ["R2_PUBLIC_URL"] = "https://r2.recruitment.test"
os.environ["FRONTEND_URL"] = "https://agentichr.dev"

# User Test Identities
FREE_USER_ID = "11111111-1111-1111-1111-111111111111"
FREE_USER_EMAIL = "free_user@example.com"

PAID_USER_ID = "22222222-2222-2222-2222-222222222222"
PAID_USER_EMAIL = "paid_user@example.com"

ADMIN_USER_ID = "33333333-3333-3333-3333-333333333333"
ADMIN_USER_EMAIL = "admin@example.com"

NON_ADMIN_USER_ID = "44444444-4444-4444-4444-444444444444"
NON_ADMIN_USER_EMAIL = "regular_user@example.com"


def create_test_jwt(
    user_id: str,
    email: str,
    exp_seconds: int = 3600,
    secret: str = TEST_JWT_SECRET,
    additional_claims: Optional[Dict[str, Any]] = None
) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": "authenticated",
        "aud": "authenticated",
        "exp": int(time.time()) + exp_seconds,
        "iat": int(time.time()),
    }
    if additional_claims:
        payload.update(additional_claims)
    return jwt.encode(payload, secret, algorithm="HS256")


def make_auth_header(token: str) -> Dict[str, str]:
    return {"Authorization": "Bearer " + token}


@pytest.fixture
def free_user_token() -> str:
    return create_test_jwt(FREE_USER_ID, FREE_USER_EMAIL)


@pytest.fixture
def free_user_headers(free_user_token) -> Dict[str, str]:
    return make_auth_header(free_user_token)


@pytest.fixture
def paid_user_token() -> str:
    return create_test_jwt(PAID_USER_ID, PAID_USER_EMAIL)


@pytest.fixture
def paid_user_headers(paid_user_token) -> Dict[str, str]:
    return make_auth_header(paid_user_token)


@pytest.fixture
def admin_user_token() -> str:
    return create_test_jwt(ADMIN_USER_ID, ADMIN_USER_EMAIL)


@pytest.fixture
def admin_user_headers(admin_user_token) -> Dict[str, str]:
    return make_auth_header(admin_user_token)


@pytest.fixture
def non_admin_user_token() -> str:
    return create_test_jwt(NON_ADMIN_USER_ID, NON_ADMIN_USER_EMAIL)


@pytest.fixture
def non_admin_headers(non_admin_user_token) -> Dict[str, str]:
    return make_auth_header(non_admin_user_token)


@pytest.fixture
def expired_token() -> str:
    return create_test_jwt(FREE_USER_ID, FREE_USER_EMAIL, exp_seconds=-3600)


@pytest.fixture
def wrong_secret_token() -> str:
    return create_test_jwt(FREE_USER_ID, FREE_USER_EMAIL, secret="wrong-secret-key")


@pytest.fixture
def malformed_token() -> str:
    return "invalid.malformed.token.payload"


class InMemoryBillingStore:
    def __init__(self):
        self.users: Dict[str, Dict[str, Any]] = {}
        self.credit_requests: Dict[str, Dict[str, Any]] = {}
        self.transactions: List[Dict[str, Any]] = []
        self.campaigns: Dict[str, Dict[str, Any]] = {}
        self.candidates: Dict[str, Dict[str, Any]] = {}

    def get_or_create_user(self, user_id: str, email: str) -> Dict[str, Any]:
        if user_id not in self.users:
            self.users[user_id] = {
                "id": str(uuid.uuid4()),
                "userId": user_id,
                "email": email,
                "plan": "free",
                "creditBalance": 0,
                "totalCvsProcessed": 0,
                "totalCampaignsCreated": 0,
                "totalInterviewsSent": 0,
                "createdAt": "2026-08-24T00:00:00Z",
                "updatedAt": "2026-08-24T00:00:00Z",
            }
        return self.users[user_id]

    def create_credit_request(self, user_id: str, amount: float, screenshot_url: str) -> Dict[str, Any]:
        if amount <= 0:
            raise ValueError("Credit request amount must be greater than zero.")
        if not screenshot_url or not screenshot_url.strip():
            raise ValueError("Screenshot URL is required.")

        req_id = str(uuid.uuid4())
        req = {
            "id": req_id,
            "userId": user_id,
            "amount": float(amount),
            "screenshotUrl": screenshot_url,
            "status": "pending",
            "rejectionReason": None,
            "creditsAllocated": None,
            "reviewedBy": None,
            "reviewedAt": None,
            "createdAt": "2026-08-24T00:00:00Z",
            "updatedAt": "2026-08-24T00:00:00Z",
        }
        self.credit_requests[req_id] = req
        return req

    def approve_credit_request(self, request_id: str, reviewer_email: str) -> Dict[str, Any]:
        if request_id not in self.credit_requests:
            raise KeyError("Credit request " + request_id + " not found.")
        req = self.credit_requests[request_id]
        if req["status"] != "pending":
            raise ValueError(f"Cannot approve request with status '{req['status']}'")

        credits_to_add = int(req["amount"] * 100)
        req["status"] = "approved"
        req["creditsAllocated"] = credits_to_add
        req["reviewedBy"] = reviewer_email
        req["reviewedAt"] = "2026-08-24T00:00:00Z"

        user = self.get_or_create_user(req["userId"], "user_" + str(req["userId"]) + "@example.com")
        user["creditBalance"] += credits_to_add
        user["plan"] = "paid"

        self.log_transaction(
            user_id=req["userId"],
            tx_type="purchase",
            credits=credits_to_add,
            description="Approved credit purchase of $" + str(req["amount"]) + " (" + str(credits_to_add) + " credits)",
            related_entity_id=request_id
        )
        return {
            "status": "success",
            "creditsAllocated": credits_to_add,
            "newBalance": user["creditBalance"]
        }

    def reject_credit_request(self, request_id: str, reviewer_email: str, reason: str) -> Dict[str, Any]:
        if request_id not in self.credit_requests:
            raise KeyError("Credit request " + request_id + " not found.")
        req = self.credit_requests[request_id]
        if req["status"] != "pending":
            raise ValueError(f"Cannot reject request with status '{req['status']}'")
        if not reason or not reason.strip():
            raise ValueError("Rejection reason cannot be empty.")

        req["status"] = "rejected"
        req["rejectionReason"] = reason.strip()
        req["reviewedBy"] = reviewer_email
        req["reviewedAt"] = "2026-08-24T00:00:00Z"
        return {"status": "success", "status": "rejected"}

    def adjust_user_credits(self, user_id: str, adjustment: int, reason: str, plan: Optional[str] = None) -> Dict[str, Any]:
        if user_id not in self.users:
            raise KeyError("User " + user_id + " not found.")
        user = self.users[user_id]
        new_balance = user["creditBalance"] + adjustment
        if new_balance < 0:
            new_balance = 0
        user["creditBalance"] = new_balance
        if plan:
            user["plan"] = plan


        self.log_transaction(
            user_id=user_id,
            tx_type="admin_adjustment",
            credits=adjustment,
            description=reason or ("Admin adjustment: " + str(adjustment) + " credits")
        )
        return {"status": "success", "newBalance": new_balance}

    def log_transaction(
        self,
        user_id: str,
        tx_type: str,
        credits: int,
        description: str,
        related_entity_id: Optional[str] = None
    ) -> Dict[str, Any]:
        tx = {
            "id": str(uuid.uuid4()),
            "userId": user_id,
            "type": tx_type,
            "credits": credits,
            "description": description,
            "relatedEntityId": related_entity_id,
            "createdAt": "2026-08-24T00:00:00Z"
        }
        self.transactions.append(tx)
        return tx

    def check_and_debit_campaign(self, user_id: str) -> bool:
        user = self.users[user_id]
        if user["plan"] == "free":
            if user["totalCampaignsCreated"] >= 5:
                raise ValueError("Free tier limit exceeded: maximum 5 campaigns allowed.")
            user["totalCampaignsCreated"] += 1
            return True
        else:
            if user["creditBalance"] < 1:
                raise ValueError("Insufficient credits: creating a campaign requires 1 credit.")
            user["creditBalance"] -= 1
            user["totalCampaignsCreated"] += 1
            self.log_transaction(
                user_id=user_id,
                tx_type="debit_campaign",
                credits=1,
                description="Campaign creation debit"
            )
            return True

    def check_and_debit_cvs(self, user_id: str, count: int = 1) -> bool:
        user = self.users[user_id]
        if user["plan"] == "free":
            if user["totalCvsProcessed"] + count > 100:
                raise ValueError("Free tier limit exceeded: maximum 100 CVs allowed (attempted " + str(user["totalCvsProcessed"] + count) + ").")
            user["totalCvsProcessed"] += count
            return True
        else:
            required_credits = count * 1
            if user["creditBalance"] < required_credits:
                raise ValueError("Insufficient credits: uploading " + str(count) + " CVs requires " + str(required_credits) + " credits.")
            user["creditBalance"] -= required_credits
            user["totalCvsProcessed"] += count
            for _ in range(count):
                self.log_transaction(
                    user_id=user_id,
                    tx_type="debit_cv",
                    credits=1,
                    description="CV processing debit"
                )
            return True

    def check_and_debit_invite(self, user_id: str) -> bool:
        user = self.users[user_id]
        if user["plan"] == "free":
            if user["totalInterviewsSent"] >= 5:
                raise ValueError("Free tier limit exceeded: maximum 5 interview invitations allowed.")
            user["totalInterviewsSent"] += 1
            return True
        else:
            if user["creditBalance"] < 1:
                raise ValueError("Insufficient credits: sending an interview invitation requires 1 credit.")
            user["creditBalance"] -= 1
            user["totalInterviewsSent"] += 1
            self.log_transaction(
                user_id=user_id,
                tx_type="debit_invite",
                credits=1,
                description="Interview invitation debit"
            )
            return True

    def check_and_debit_evaluation(self, user_id: str, candidate_id: str) -> bool:
        user = self.users[user_id]
        if user["plan"] == "free":
            return True
        else:
            if user["creditBalance"] < 2:
                raise ValueError("Insufficient credits: candidate evaluation requires 2 credits.")
            user["creditBalance"] -= 2
            self.log_transaction(
                user_id=user_id,
                tx_type="debit_evaluation",
                credits=2,
                description="Candidate evaluation debit",
                related_entity_id=candidate_id
            )
            return True

    def get_admin_stats(self) -> Dict[str, Any]:
        total_users = len(self.users)
        free_count = sum(1 for u in self.users.values() if u["plan"] == "free")
        paid_count = sum(1 for u in self.users.values() if u["plan"] == "paid")
        total_cvs = sum(u["totalCvsProcessed"] for u in self.users.values())
        total_campaigns = sum(u["totalCampaignsCreated"] for u in self.users.values())
        total_interviews = sum(u["totalInterviewsSent"] for u in self.users.values())
        total_credits = sum(
            req["creditsAllocated"] or 0
            for req in self.credit_requests.values()
            if req["status"] == "approved"
        )
        total_revenue = sum(
            req["amount"]
            for req in self.credit_requests.values()
            if req["status"] == "approved"
        )
        pending_requests = sum(
            1 for req in self.credit_requests.values() if req["status"] == "pending"
        )

        return {
            "totalUsers": total_users,
            "planBreakdown": {"free": free_count, "paid": paid_count},
            "totalCvsProcessed": total_cvs,
            "totalCampaignsCreated": total_campaigns,
            "totalInterviewsSent": total_interviews,
            "totalCreditsAllocated": total_credits,
            "totalRevenue": float(total_revenue),
            "pendingRequestsCount": pending_requests
        }


    def list_user_credit_requests(self, user_id: str) -> List[Dict[str, Any]]:
        return [req for req in self.credit_requests.values() if req['userId'] == user_id]


    def list_user_transactions(self, user_id: str) -> List[Dict[str, Any]]:
        return [tx for tx in self.transactions if tx['userId'] == user_id]


    def list_all_users(self) -> List[Dict[str, Any]]:
        return list(self.users.values())

    def list_admin_credit_requests(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        if status:
            return [req for req in self.credit_requests.values() if req['status'] == status]
        return list(self.credit_requests.values())


@pytest.fixture
def billing_store() -> InMemoryBillingStore:
    return InMemoryBillingStore()


@pytest.fixture
def mock_r2_client():
    with patch("boto3.client") as mock_boto:
        s3_mock = MagicMock()
        s3_mock.generate_presigned_url.return_value = "https://r2.test-upload.signed.url/presigned-put"
        mock_boto.return_value = s3_mock
        yield s3_mock

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from app.security import require_admin
from app.database import prisma
from app.services import billing_service
from app.core.logging import logger

router = APIRouter(prefix="/api/admin", tags=["Admin Portal"], dependencies=[Depends(require_admin)])


class RejectRequest(BaseModel):
    reason: Optional[str] = Field("Unreadable or invalid payment receipt", description="Reason for rejection")


class CreditAdjustmentRequest(BaseModel):
    adjustment: int = Field(..., description="Credits to add (positive) or deduct (negative)")
    reason: Optional[str] = Field("Admin manual adjustment", description="Audit reason for adjustment")
    plan: Optional[str] = Field(None, description="Optional plan override ('free' | 'paid')")


def _get_admin_email(user: dict) -> str:
    email = user.get("email") or ""
    if not email and isinstance(user.get("user_metadata"), dict):
        email = user["user_metadata"].get("email") or ""
    return str(email or "admin@system.local")


@router.get("/users")
async def list_admin_users():
    """
    List all registered user profiles with plan details, credit balances, and usage counters.
    """
    users = await prisma.userprofile.find_many(
        order={"createdAt": "desc"}
    )
    return users


@router.get("/credit-requests")
async def list_admin_credit_requests(status: Optional[str] = Query(None, description="Filter by status ('pending', 'approved', 'rejected')")):
    """
    List payment credit requests with attached user profiles.
    """
    where_filter: Dict[str, Any] = {}
    if status and status.strip():
        where_filter["status"] = status.strip().lower()

    requests = await prisma.creditrequest.find_many(
        where=where_filter,
        include={"user": True},
        order={"createdAt": "desc"}
    )
    return requests


@router.post("/credit-requests/{id}/approve")
async def approve_user_credit_request(
    id: str,
    user: dict = Depends(require_admin)
):
    """
    Approve a pending payment request, converting USD to credits at $1 = 100 credits,
    upgrading user to 'paid' tier, and logging an immutable purchase transaction.
    """
    admin_email = _get_admin_email(user)
    result = await billing_service.approve_credit_request(id, admin_email)
    return result


@router.post("/credit-requests/{id}/reject")
async def reject_user_credit_request(
    id: str,
    body: Optional[RejectRequest] = None,
    user: dict = Depends(require_admin)
):
    """
    Reject a pending payment request with an audit reason.
    """
    admin_email = _get_admin_email(user)
    reason = body.reason if body and body.reason else "Unreadable or invalid payment receipt"
    result = await billing_service.reject_credit_request(id, admin_email, reason)
    return {
        "status": "success",
        "status_name": "rejected",
        "rejectionReason": result.get("rejectionReason")
    }


@router.patch("/users/{userId}/credits")
async def adjust_user_credits(
    userId: str,
    body: CreditAdjustmentRequest,
    user: dict = Depends(require_admin)
):
    """
    Manually adjust a user's credit balance and/or plan tier with an audit transaction log.
    """
    if body.plan and body.plan not in ["free", "paid"]:
        raise HTTPException(status_code=400, detail="Plan must be either 'free' or 'paid'.")

    result = await billing_service.adjust_user_credits(
        user_id=userId,
        adjustment=body.adjustment,
        reason=body.reason or "Admin manual adjustment",
        plan=body.plan
    )
    return result


@router.get("/stats")
async def get_system_stats():
    """
    Retrieve aggregated platform analytics, revenue, credit metrics, and plan breakdowns.
    """
    stats = await billing_service.get_admin_stats()
    return stats

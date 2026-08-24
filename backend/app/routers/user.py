from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from app.security import verify_jwt, is_admin_user
from app.database import prisma
from app.services import billing_service
from app.services.r2_service import generate_presigned_payment_screenshot_url
from app.core.logging import logger

router = APIRouter(tags=["User Billing & Profile"])


class CreditRequestCreate(BaseModel):
    amount: float = Field(..., gt=0, description="Purchase amount in USD (e.g. 10.0)")
    screenshotUrl: str = Field(..., min_length=5, description="Public URL or object key of the uploaded payment receipt")


def _get_user_info(user: dict) -> tuple[str, str]:
    user_id = user.get("sub") or user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token.")
    
    email = user.get("email") or ""
    if not email and isinstance(user.get("user_metadata"), dict):
        email = user["user_metadata"].get("email") or ""
    return str(user_id), str(email)


@router.get("/api/user/profile")
async def get_user_profile(user: dict = Depends(verify_jwt)):
    """
    Fetch or auto-provision the user profile along with admin authorization flag.
    """
    user_id, email = _get_user_info(user)
    profile = await billing_service.get_or_create_user_profile(user_id, email)
    is_admin = is_admin_user(user)

    profile_dict = profile.model_dump() if hasattr(profile, "model_dump") else profile.dict()
    return {
        "profile": profile_dict,
        "isAdmin": is_admin
    }


@router.get("/api/upload/payment-screenshot-presigned-url")
async def get_payment_screenshot_presigned_url(
    filename: str = Query(..., description="File name of the screenshot"),
    contentType: Optional[str] = Query("image/png", description="MIME content type"),
    user: dict = Depends(verify_jwt)
):
    """
    Generate a presigned PUT URL strictly scoped to payment-screenshots/{userId}/
    for browser direct uploads of payment receipts.
    """
    user_id, _ = _get_user_info(user)
    try:
        res = generate_presigned_payment_screenshot_url(
            user_id=user_id,
            filename=filename,
            content_type=contentType or "image/png"
        )
        return res
    except ValueError as ve:
        logger.error(f"[R2 Payment] Configuration error: {ve}")
        raise HTTPException(status_code=500, detail=str(ve))
    except Exception as e:
        logger.error(f"[R2 Payment] Failed to generate payment presigned URL: {e}")
        raise HTTPException(status_code=500, detail="Could not generate payment screenshot upload URL.")


@router.post("/api/user/credit-requests")
async def create_credit_request(
    body: CreditRequestCreate,
    user: dict = Depends(verify_jwt)
):
    """
    Submit a proof-of-payment credit purchase request for admin approval.
    """
    user_id, email = _get_user_info(user)
    # Ensure profile exists
    await billing_service.get_or_create_user_profile(user_id, email)

    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Purchase amount must be greater than $0.00.")

    credit_req = await prisma.creditrequest.create(
        data={
            "userId": user_id,
            "amount": float(body.amount),
            "screenshotUrl": body.screenshotUrl.strip(),
            "status": "pending",
            "creditsAllocated": 0
        }
    )
    logger.info(f"[Credit Request] User {user_id} submitted request {credit_req.id} for ${body.amount:.2f}")
    return credit_req


@router.get("/api/user/credit-requests")
async def list_user_credit_requests(user: dict = Depends(verify_jwt)):
    """
    Retrieve all payment credit requests submitted by the current user.
    """
    user_id, _ = _get_user_info(user)
    requests = await prisma.creditrequest.find_many(
        where={"userId": user_id},
        order={"createdAt": "desc"}
    )
    return requests


@router.get("/api/user/transactions")
async def list_user_transactions(user: dict = Depends(verify_jwt)):
    """
    Retrieve the immutable credit transaction audit log for the current user.
    """
    user_id, _ = _get_user_info(user)
    transactions = await prisma.credittransaction.find_many(
        where={"userId": user_id},
        order={"createdAt": "desc"}
    )
    return transactions

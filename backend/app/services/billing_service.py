import datetime
from typing import Optional, Dict, Any, List
from fastapi import HTTPException
from app.database import prisma
from prisma.models import UserProfile, CreditRequest, CreditTransaction
from prisma.errors import UniqueViolationError
from app.core.logging import logger

FREE_MAX_CAMPAIGNS = 5
FREE_MAX_CVS = 100
FREE_MAX_INTERVIEWS = 5
CREDITS_PER_DOLLAR = 100
CREDITS_PER_EVALUATION = 2


async def get_or_create_user_profile(user_id: str, email: str = "") -> UserProfile:
    """
    Idempotently fetches or provisions a UserProfile with default Free tier attributes.
    """
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user_id provided.")

    clean_email = (email or "").strip().lower()

    profile = await prisma.userprofile.find_unique(where={"userId": user_id})
    if profile:
        # If email was updated or empty previously, update it
        if clean_email and (not profile.email or profile.email != clean_email):
            try:
                profile = await prisma.userprofile.update(
                    where={"userId": user_id},
                    data={"email": clean_email}
                )
            except Exception as e:
                logger.warning(f"[Billing] Could not update email for user {user_id}: {e}")
        return profile

    fallback_email = clean_email or f"{user_id}@user.local"
    try:
        profile = await prisma.userprofile.create(
            data={
                "userId": user_id,
                "email": fallback_email,
                "plan": "free",
                "creditBalance": 0,
                "totalCvsProcessed": 0,
                "totalCampaignsCreated": 0,
                "totalInterviewsSent": 0,
            }
        )
        logger.info(f"[Billing] Auto-provisioned UserProfile for userId '{user_id}' with plan 'free'.")
        return profile
    except UniqueViolationError:
        # Concurrent creation race condition safe recovery
        existing = await prisma.userprofile.find_unique(where={"userId": user_id})
        if existing:
            return existing
        raise HTTPException(status_code=500, detail="Failed to retrieve or create user profile.")


async def validate_and_deduct_campaign_creation(
    user_id: str,
    email: str,
    num_resumes: int,
    campaign_title: str,
    campaign_id: str
) -> UserProfile:
    """
    Validates limits and performs deductions for campaign creation and resume uploads.
    - Free tier: validates totalCampaignsCreated + 1 <= 5 and totalCvsProcessed + num_resumes <= 100.
    - Paid tier: validates creditBalance >= 1 + num_resumes, deducts credits, and logs transactions.
    """
    profile = await get_or_create_user_profile(user_id, email)

    if profile.plan == "free":
        # Atomic check and update for free quota
        rows_affected = await prisma.execute_raw('''
            UPDATE "UserProfile"
            SET "totalCampaignsCreated" = "totalCampaignsCreated" + 1,
                "totalCvsProcessed" = "totalCvsProcessed" + $1,
                "updatedAt" = NOW()
            WHERE "userId" = $2
              AND "plan" = 'free'
              AND ("totalCampaignsCreated" + 1) <= $3
              AND ("totalCvsProcessed" + $1) <= $4
        ''', num_resumes, user_id, FREE_MAX_CAMPAIGNS, FREE_MAX_CVS)

        if rows_affected == 0:
            latest = await prisma.userprofile.find_unique(where={"userId": user_id})
            if latest and (latest.totalCampaignsCreated + 1 > FREE_MAX_CAMPAIGNS):
                raise HTTPException(
                    status_code=402,
                    detail=f"Free plan limit exceeded: maximum {FREE_MAX_CAMPAIGNS} campaigns allowed (current: {latest.totalCampaignsCreated}). Please upgrade to a paid plan."
                )
            if latest and (latest.totalCvsProcessed + num_resumes > FREE_MAX_CVS):
                raise HTTPException(
                    status_code=402,
                    detail=f"Free plan limit exceeded: maximum {FREE_MAX_CVS} CV uploads allowed (current: {latest.totalCvsProcessed}, requested: {num_resumes}). Please upgrade to a paid plan."
                )
            raise HTTPException(status_code=402, detail="Free plan limit exceeded. Please upgrade to a paid plan.")

        updated = await prisma.userprofile.find_unique(where={"userId": user_id})
        return updated or profile

    # Paid tier logic - atomic debit
    required_credits = 1 + num_resumes
    rows_affected = await prisma.execute_raw('''
        UPDATE "UserProfile"
        SET "creditBalance" = "creditBalance" - $1,
            "totalCampaignsCreated" = "totalCampaignsCreated" + 1,
            "totalCvsProcessed" = "totalCvsProcessed" + $2,
            "updatedAt" = NOW()
        WHERE "userId" = $3
          AND "plan" = 'paid'
          AND "creditBalance" >= $1
    ''', required_credits, num_resumes, user_id)

    if rows_affected == 0:
        latest = await prisma.userprofile.find_unique(where={"userId": user_id})
        avail = latest.creditBalance if latest else 0
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient credit balance. Required: {required_credits} credits (1 for campaign + {num_resumes} for CVs), available: {avail} credits. Please purchase more credits."
        )

    updated_profile = await prisma.userprofile.find_unique(where={"userId": user_id})

    # Log 2 CreditTransaction records: 1 for campaign creation, 1 for CV uploads
    await prisma.credittransaction.create(
        data={
            "userId": user_id,
            "type": "debit_campaign",
            "credits": -1,
            "description": f"Campaign creation: {campaign_title}",
            "relatedEntityId": campaign_id
        }
    )

    await prisma.credittransaction.create(
        data={
            "userId": user_id,
            "type": "debit_cv",
            "credits": -num_resumes,
            "description": f"Processed {num_resumes} CV(s) for campaign: {campaign_title}",
            "relatedEntityId": campaign_id
        }
    )

    logger.info(f"[Billing] Deducted {required_credits} credits from user {user_id} for campaign '{campaign_title}' ({campaign_id}). New balance: {updated_profile.creditBalance if updated_profile else 'unknown'}")
    return updated_profile or profile


async def validate_and_deduct_interview_invitations(
    user_id: str,
    email: str,
    num_candidates: int
) -> UserProfile:
    """
    Validates limits and performs deductions for sending interview invitations.
    - Free tier: validates totalInterviewsSent + num_candidates <= 5.
    - Paid tier: validates creditBalance >= num_candidates, deducts credits (1/invite), and logs transaction.
    """
    if num_candidates <= 0:
        return await get_or_create_user_profile(user_id, email)

    profile = await get_or_create_user_profile(user_id, email)

    if profile.plan == "free":
        rows_affected = await prisma.execute_raw('''
            UPDATE "UserProfile"
            SET "totalInterviewsSent" = "totalInterviewsSent" + $1,
                "updatedAt" = NOW()
            WHERE "userId" = $2
              AND "plan" = 'free'
              AND ("totalInterviewsSent" + $1) <= $3
        ''', num_candidates, user_id, FREE_MAX_INTERVIEWS)

        if rows_affected == 0:
            latest = await prisma.userprofile.find_unique(where={"userId": user_id})
            cur = latest.totalInterviewsSent if latest else 0
            raise HTTPException(
                status_code=402,
                detail=f"Free plan limit exceeded: maximum {FREE_MAX_INTERVIEWS} interview invitations allowed (current: {cur}, requested: {num_candidates}). Please upgrade to a paid plan."
            )

        updated = await prisma.userprofile.find_unique(where={"userId": user_id})
        return updated or profile

    # Paid tier logic - atomic debit
    required_credits = num_candidates
    rows_affected = await prisma.execute_raw('''
        UPDATE "UserProfile"
        SET "creditBalance" = "creditBalance" - $1,
            "totalInterviewsSent" = "totalInterviewsSent" + $1,
            "updatedAt" = NOW()
        WHERE "userId" = $2
          AND "plan" = 'paid'
          AND "creditBalance" >= $1
    ''', required_credits, user_id)

    if rows_affected == 0:
        latest = await prisma.userprofile.find_unique(where={"userId": user_id})
        avail = latest.creditBalance if latest else 0
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient credit balance. Required: {required_credits} credits ({num_candidates} invitation(s)), available: {avail} credits. Please purchase more credits."
        )

    updated_profile = await prisma.userprofile.find_unique(where={"userId": user_id})

    await prisma.credittransaction.create(
        data={
            "userId": user_id,
            "type": "debit_invite",
            "credits": -num_candidates,
            "description": f"Sent {num_candidates} interview invitation(s)",
            "relatedEntityId": None
        }
    )

    logger.info(f"[Billing] Deducted {required_credits} credits from user {user_id} for {num_candidates} interview invitations. New balance: {updated_profile.creditBalance if updated_profile else 'unknown'}")
    return updated_profile or profile


async def deduct_evaluation_credits(
    user_id: Optional[str],
    candidate_id: str,
    candidate_name: str
) -> Optional[UserProfile]:
    """
    Deducts 2 credits upon candidate evaluation completion for paid users.
    Safe for async worker execution (gracefully handles free users or missing profiles).
    """
    if not user_id:
        return None

    try:
        profile = await prisma.userprofile.find_unique(where={"userId": user_id})
        if not profile:
            return None

        # Only paid tier users are charged per completed candidate evaluation
        if profile.plan != "paid":
            return profile

        deduction = CREDITS_PER_EVALUATION
        rows_affected = await prisma.execute_raw('''
            UPDATE "UserProfile"
            SET "creditBalance" = "creditBalance" - $1,
                "updatedAt" = NOW()
            WHERE "userId" = $2
              AND "plan" = 'paid'
        ''', deduction, user_id)

        if rows_affected > 0:
            await prisma.credittransaction.create(
                data={
                    "userId": user_id,
                    "type": "debit_evaluation",
                    "credits": -deduction,
                    "description": f"Evaluation completed for candidate: {candidate_name}",
                    "relatedEntityId": candidate_id
                }
            )

        updated_profile = await prisma.userprofile.find_unique(where={"userId": user_id})
        logger.info(f"[Billing] Deducted {deduction} evaluation credits from user {user_id} for candidate '{candidate_name}' ({candidate_id}). New balance: {updated_profile.creditBalance if updated_profile else 'unknown'}")
        return updated_profile or profile
    except Exception as e:
        logger.error(f"[Billing] Failed to deduct evaluation credits for user {user_id}, candidate {candidate_id}: {e}")
        return None


async def approve_credit_request(request_id: str, admin_email: str) -> Dict[str, Any]:
    """
    Approves a pending credit request ($1 = 100 credits), upgrades user to 'paid',
    allocates credits, and logs a 'purchase' transaction.
    """
    credit_req = await prisma.creditrequest.find_unique(
        where={"id": request_id},
        include={"user": True}
    )
    if not credit_req:
        raise HTTPException(status_code=404, detail="Credit request not found.")

    if credit_req.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Credit request is already {credit_req.status}."
        )

    # 1 USD = 100 credits
    credits_to_allocate = int(round(credit_req.amount * CREDITS_PER_DOLLAR))
    now = datetime.datetime.now(datetime.timezone.utc)

    # Fetch latest user profile or ensure it exists
    await get_or_create_user_profile(credit_req.userId)

    # Update request
    await prisma.creditrequest.update(
        where={"id": request_id},
        data={
            "status": "approved",
            "creditsAllocated": credits_to_allocate,
            "reviewedBy": admin_email,
            "reviewedAt": now
        }
    )

    # Atomic increment on user profile: set plan='paid', add credits
    await prisma.execute_raw('''
        UPDATE "UserProfile"
        SET "plan" = 'paid',
            "creditBalance" = "creditBalance" + $1,
            "updatedAt" = NOW()
        WHERE "userId" = $2
    ''', credits_to_allocate, credit_req.userId)

    updated_profile = await prisma.userprofile.find_unique(where={"userId": credit_req.userId})
    new_balance = updated_profile.creditBalance if updated_profile else credits_to_allocate

    # Log purchase transaction
    await prisma.credittransaction.create(
        data={
            "userId": credit_req.userId,
            "type": "purchase",
            "credits": credits_to_allocate,
            "description": f"Approved payment proof of ${credit_req.amount:.2f} (+{credits_to_allocate} credits)",
            "relatedEntityId": credit_req.id
        }
    )

    logger.info(f"[Billing Admin] Approved credit request {request_id} for user {credit_req.userId}. Allocated: {credits_to_allocate} credits. New balance: {new_balance}")
    return {
        "status": "success",
        "creditsAllocated": credits_to_allocate,
        "newBalance": new_balance
    }


async def reject_credit_request(request_id: str, admin_email: str, reason: str) -> Dict[str, Any]:
    """
    Rejects a pending credit request with a given reason.
    """
    credit_req = await prisma.creditrequest.find_unique(where={"id": request_id})
    if not credit_req:
        raise HTTPException(status_code=404, detail="Credit request not found.")

    if credit_req.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Credit request is already {credit_req.status}."
        )

    now = datetime.datetime.now(datetime.timezone.utc)
    rejection_reason = (reason or "").strip() or "Payment verification failed"

    await prisma.creditrequest.update(
        where={"id": request_id},
        data={
            "status": "rejected",
            "rejectionReason": rejection_reason,
            "reviewedBy": admin_email,
            "reviewedAt": now
        }
    )

    logger.info(f"[Billing Admin] Rejected credit request {request_id} for user {credit_req.userId}. Reason: '{rejection_reason}'")
    return {
        "status": "success",
        "status_name": "rejected",
        "rejectionReason": rejection_reason
    }


async def adjust_user_credits(
    user_id: str,
    adjustment: int,
    reason: str,
    plan: Optional[str] = None
) -> Dict[str, Any]:
    """
    Manually adjusts a user's credit balance and optionally updates their plan.
    Logs an 'admin_adjustment' transaction.
    """
    profile = await prisma.userprofile.find_unique(where={"userId": user_id})
    if not profile:
        raise HTTPException(status_code=404, detail="User profile not found.")

    if plan and plan in ["free", "paid"]:
        await prisma.execute_raw('''
            UPDATE "UserProfile"
            SET "creditBalance" = "creditBalance" + $1,
                "plan" = $2,
                "updatedAt" = NOW()
            WHERE "userId" = $3
        ''', adjustment, plan, user_id)
    else:
        await prisma.execute_raw('''
            UPDATE "UserProfile"
            SET "creditBalance" = "creditBalance" + $1,
                "updatedAt" = NOW()
            WHERE "userId" = $2
        ''', adjustment, user_id)

    updated_profile = await prisma.userprofile.find_unique(where={"userId": user_id})
    new_balance = updated_profile.creditBalance if updated_profile else (profile.creditBalance + adjustment)
    final_plan = updated_profile.plan if updated_profile else profile.plan

    clean_reason = (reason or "").strip() or "Manual admin credit adjustment"
    await prisma.credittransaction.create(
        data={
            "userId": user_id,
            "type": "admin_adjustment",
            "credits": adjustment,
            "description": clean_reason,
            "relatedEntityId": None
        }
    )

    logger.info(f"[Billing Admin] Adjusted credits for user {user_id} by {adjustment}. New balance: {new_balance}, plan: {final_plan}")
    return {
        "status": "success",
        "newBalance": new_balance,
        "plan": final_plan
    }



async def get_admin_stats() -> Dict[str, Any]:
    """
    Calculates aggregated system statistics for the admin dashboard.
    """
    # 1. Total users and plan breakdown
    users = await prisma.userprofile.find_many()
    total_users = len(users)
    free_count = sum(1 for u in users if u.plan == "free")
    paid_count = sum(1 for u in users if u.plan == "paid")

    total_cvs = sum(u.totalCvsProcessed for u in users)
    total_campaigns = sum(u.totalCampaignsCreated for u in users)
    total_interviews = sum(u.totalInterviewsSent for u in users)

    # 2. Approved credit requests for revenue and total credits allocated
    approved_requests = await prisma.creditrequest.find_many(where={"status": "approved"})
    total_revenue = sum(r.amount for r in approved_requests)
    total_credits_allocated = sum(r.creditsAllocated for r in approved_requests)

    # 3. Pending requests count
    pending_count = await prisma.creditrequest.count(where={"status": "pending"})

    return {
        "totalUsers": total_users,
        "planBreakdown": {
            "free": free_count,
            "paid": paid_count
        },
        "totalCvsProcessed": total_cvs,
        "totalCampaignsCreated": total_campaigns,
        "totalInterviewsSent": total_interviews,
        "totalCreditsAllocated": total_credits_allocated,
        "totalRevenue": round(float(total_revenue), 2),
        "pendingRequestsCount": pending_count
    }

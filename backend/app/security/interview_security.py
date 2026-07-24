import jwt
import os
import datetime
from typing import Dict, Any
from fastapi import HTTPException

SECRET_KEY = os.getenv("SUPABASE_JWT_SECRET", "super-secret-recruitment-key-2026")
ALGORITHM = "HS256"

def generate_interview_token(candidate_id: str, email: str, expires_in_days: int = 14) -> str:
    """Generates a secure cryptographic JWT token for candidate interview access."""
    expiration = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=expires_in_days)
    payload = {
        "sub": candidate_id,
        "email": email.lower().strip() if email else "",
        "type": "interview_invite",
        "exp": expiration,
        "iat": datetime.datetime.now(datetime.timezone.utc)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def verify_interview_token(token: str) -> Dict[str, Any]:
    """
    Verifies and decodes the interview access token.
    Raises HTTPException if invalid or expired.
    """
    if not token:
        raise HTTPException(status_code=401, detail="Access token missing")
        
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_aud": False})
        if payload.get("type") != "interview_invite":
            raise HTTPException(status_code=403, detail="Invalid token type")
            
        return {
            "candidate_id": payload.get("sub"),
            "email": payload.get("email")
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Interview invitation link has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=403, detail="Invalid or tampered interview link token")

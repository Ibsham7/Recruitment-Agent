import jwt
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
import httpx
import time
from typing import Dict, Any, Tuple, Optional, List
from app.core.logging import logger

security = HTTPBearer()

# In-memory token cache: token_hash -> (payload, expires_at)
_token_cache: Dict[str, Tuple[Dict[str, Any], float]] = {}

# Shared HTTP client for Supabase GoTrue fallback with connection pooling
_http_client: Optional[httpx.AsyncClient] = None

def _get_shared_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=15.0,
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=50)
        )
    return _http_client

async def verify_jwt(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    now = time.time()
    
    # 1. Check in-memory cache for fast sub-millisecond response on concurrent requests
    cached = _token_cache.get(token)
    if cached:
        payload, expires_at = cached
        if now < expires_at:
            return payload
        else:
            _token_cache.pop(token, None)

    secret = os.getenv("SUPABASE_JWT_SECRET")
    
    if not secret or secret == "your-supabase-jwt-secret-here":
        raise HTTPException(
            status_code=500,
            detail="Server configuration error: SUPABASE_JWT_SECRET is missing or not configured securely"
        )

    try:
        # Decode token. Disable audience verification since it might vary
        payload = jwt.decode(token, secret, algorithms=["HS256"], options={"verify_aud": False})
        exp = payload.get("exp", now + 300)
        _token_cache[token] = (payload, min(exp, now + 300))
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        # Production-grade fallback: Verify token with Supabase GoTrue API
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")
        
        if not supabase_url or not supabase_anon_key:
            raise HTTPException(status_code=401, detail="Invalid token signature and Supabase config missing")
            
        try:
            client = _get_shared_client()
            response = await client.get(
                f"{supabase_url}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": supabase_anon_key
                }
            )
            if response.status_code == 200:
                user_data = response.json()
                payload = {"sub": user_data.get("id"), **user_data}
                # Cache successful auth verification for up to 5 minutes to prevent hammering Supabase
                _token_cache[token] = (payload, now + 300)
                return payload
            else:
                raise HTTPException(status_code=401, detail="Invalid token")
        except httpx.RequestError as req_err:
            logger.error(f"[Auth] Supabase GoTrue verification failed: {req_err}")
            raise HTTPException(status_code=500, detail="Auth verification failed")

def get_admin_emails() -> List[str]:
    """Retrieve cleaned lowercase list of admin emails from environment."""
    raw = os.getenv("ADMIN_EMAILS", "")
    if not raw:
        return []
    return [e.strip().lower() for e in raw.split(",") if e.strip()]

def is_admin_email(email: Optional[str]) -> bool:
    """Check if an email address is in the ADMIN_EMAILS allowlist."""
    if not email or not isinstance(email, str):
        return False
    admin_emails = get_admin_emails()
    return email.strip().lower() in admin_emails

def is_admin_user(user: dict) -> bool:
    """Extract email from JWT payload or metadata and verify admin status."""
    if not isinstance(user, dict):
        return False
    email = user.get("email")
    if not email and isinstance(user.get("user_metadata"), dict):
        email = user["user_metadata"].get("email")
    return is_admin_email(email)

async def require_admin(user: dict = Depends(verify_jwt)) -> dict:
    """
    FastAPI dependency guard that ensures the caller has admin privileges.
    Raises HTTP 403 Forbidden if user is not authorized or ADMIN_EMAILS is empty.
    """
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return user




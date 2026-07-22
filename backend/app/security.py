import jwt
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
import requests
security = HTTPBearer()

def verify_jwt(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    secret = os.getenv("SUPABASE_JWT_SECRET")
    
    if not secret or secret == "your-supabase-jwt-secret-here":
        # For development flexibility if they haven't set it yet
        print("Warning: SUPABASE_JWT_SECRET is missing or not set securely.")
        if os.getenv("SUPABASE_JWT_SECRET") != "your-supabase-jwt-secret-here":
            pass # They have set something else

    try:
        # Decode token. Disable audience verification since it might vary
        # Allowing more algorithms doesn't hurt if signature validation fails anyway, but fallback handles it
        payload = jwt.decode(token, secret, algorithms=["HS256", "ES256", "RS256"], options={"verify_aud": False})
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        # Production-grade fallback: Verify token with Supabase GoTrue API
        # This catches all decoding, signature, and algorithm errors
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")
        
        if not supabase_url or not supabase_anon_key:
            raise HTTPException(status_code=401, detail="Invalid token signature and Supabase config missing")
            
        try:
            response = requests.get(
                f"{supabase_url}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": supabase_anon_key
                },
                timeout=5
            )
            if response.status_code == 200:
                user_data = response.json()
                # Return payload compatible with JWT shape (app uses user.get("sub"))
                return {"sub": user_data.get("id"), **user_data}
            else:
                raise HTTPException(status_code=401, detail="Invalid token")
        except requests.RequestException:
            raise HTTPException(status_code=500, detail="Auth verification failed")

import jwt
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os

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
        payload = jwt.decode(token, secret, algorithms=["HS256"], options={"verify_aud": False})
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

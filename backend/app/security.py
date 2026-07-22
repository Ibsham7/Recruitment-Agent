import jwt
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
import httpx

security = HTTPBearer()

async def verify_jwt(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    secret = os.getenv("SUPABASE_JWT_SECRET")
    
    if not secret or secret == "your-supabase-jwt-secret-here":
        print("Warning: SUPABASE_JWT_SECRET is missing or not set securely.")

    try:
        # Decode token. Disable audience verification since it might vary
        payload = jwt.decode(token, secret, algorithms=["HS256", "ES256", "RS256"], options={"verify_aud": False})
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
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{supabase_url}/auth/v1/user",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "apikey": supabase_anon_key
                    },
                    timeout=5.0
                )
            if response.status_code == 200:
                user_data = response.json()
                return {"sub": user_data.get("id"), **user_data}
            else:
                raise HTTPException(status_code=401, detail="Invalid token")
        except httpx.RequestError:
            raise HTTPException(status_code=500, detail="Auth verification failed")


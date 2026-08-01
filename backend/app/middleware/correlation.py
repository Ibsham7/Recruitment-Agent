import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request, Response
from app.core.logging import correlation_id_ctx

class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """
    FastAPI Middleware that extracts or generates a unique correlation ID for every request,
    storing it in a contextvar so all logs generated within the request lifecycle automatically include it.
    """
    async def dispatch(self, request: Request, call_next) -> Response:
        header_correlation_id = request.headers.get("X-Correlation-ID") or request.headers.get("X-Request-ID")
        correlation_id = header_correlation_id if header_correlation_id else str(uuid.uuid4())
        
        token = correlation_id_ctx.set(correlation_id)
        try:
            response = await call_next(request)
            response.headers["X-Correlation-ID"] = correlation_id
            return response
        finally:
            correlation_id_ctx.reset(token)

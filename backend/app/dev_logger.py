import os
from app.core.logging import logger, candidate_id_ctx

# Enable dev/event logging unless ENV is explicitly production
DEV_LOGGING_ENABLED = os.environ.get("ENV", "development") != "production"

def log_event(candidate_id: str, node_name: str, message: str):
    """
    Log an event record. Delegated to structured JSON logger outputting to sys.stdout.
    """
    if not DEV_LOGGING_ENABLED:
        return
    if candidate_id:
        candidate_id_ctx.set(candidate_id)
    
    logger.info(message, extra={"node_name": node_name})

def log_error(candidate_id: str, context: str, exception: Exception):
    """
    Log an exception record. Delegated to structured JSON logger outputting to sys.stdout with traceback.
    """
    if not DEV_LOGGING_ENABLED:
        return
    if candidate_id:
        candidate_id_ctx.set(candidate_id)
        
    logger.error(f"[{context}] Exception occurred", exc_info=exception, extra={"context": context})

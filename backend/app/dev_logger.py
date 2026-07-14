import os
import sys
import traceback
from datetime import datetime

# Enable detailed dev logging unless ENV is explicitly production
DEV_LOGGING_ENABLED = os.environ.get("ENV", "development") != "production"

def log_event(candidate_id: str, node_name: str, message: str):
    if not DEV_LOGGING_ENABLED:
        return
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open("log.txt", "a", encoding="utf-8") as f:
        f.write(f"[{timestamp}] [{candidate_id}] [{node_name}] {message}\n")

def log_error(candidate_id: str, context: str, exception: Exception):
    if not DEV_LOGGING_ENABLED:
        return
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    exc_info = "".join(traceback.format_exception(type(exception), exception, exception.__traceback__))
    with open("log.txt", "a", encoding="utf-8") as f:
        f.write(f"[{timestamp}] [{candidate_id}] [ERROR] [{context}]\n{exc_info}\n")

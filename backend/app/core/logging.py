import json
import logging
import sys
from datetime import datetime, timezone
from contextvars import ContextVar
from typing import Any, Dict

# Global context variables for request correlation & candidate tracing across async tasks
correlation_id_ctx: ContextVar[str] = ContextVar("correlation_id", default="")
candidate_id_ctx: ContextVar[str] = ContextVar("candidate_id", default="")

class JSONFormatter(logging.Formatter):
    """
    Production-grade Formatter that outputs log events as single-line JSON objects to stdout.
    Automatically includes trace correlation ID and candidate context if present.
    """
    def format(self, record: logging.LogRecord) -> str:
        log_data: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Inject context variables if set
        cid = correlation_id_ctx.get()
        if cid:
            log_data["correlation_id"] = cid

        candidate_id = candidate_id_ctx.get()
        if candidate_id:
            log_data["candidate_id"] = candidate_id

        # Include custom node_name or extra attributes passed to logger
        if hasattr(record, "node_name"):
            log_data["node_name"] = record.node_name

        # Include exception tracebacks if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        # Merge additional custom fields from record.__dict__
        standard_attrs = {
            "name", "msg", "args", "levelname", "levelno", "pathname", "filename",
            "module", "exc_info", "exc_text", "stack_info", "lineno", "funcName",
            "created", "msecs", "relativeCreated", "thread", "threadName",
            "processName", "process", "message", "node_name"
        }
        extra = {k: v for k, v in record.__dict__.items() if k not in standard_attrs}
        if extra:
            log_data.update(extra)

        return json.dumps(log_data, ensure_ascii=False)

def setup_logging(level: int = logging.INFO):
    """Configures system-wide root logger to emit structured JSON logs to sys.stdout."""
    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    # Clear existing handlers to prevent duplicate logging
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(JSONFormatter())
    root_logger.addHandler(stream_handler)

logger = logging.getLogger("recruitment_agent")

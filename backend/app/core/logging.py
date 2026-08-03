import json
import logging
import os
import sys
from datetime import datetime, timezone
from contextvars import ContextVar
from typing import Any, Dict

# Global context variables for request correlation & candidate tracing across async tasks
correlation_id_ctx: ContextVar[str] = ContextVar("correlation_id", default="")
candidate_id_ctx: ContextVar[str] = ContextVar("candidate_id", default="")

class ConsoleFormatter(logging.Formatter):
    """
    Human-friendly Formatter for terminal development.
    Emits readable, formatted single lines without JSON clutter.
    """
    def format(self, record: logging.LogRecord) -> str:
        time_str = datetime.now().strftime("%H:%M:%S")
        level = record.levelname.ljust(5)
        logger_name = record.name
        msg = record.getMessage()

        context_parts = []
        cid = correlation_id_ctx.get()
        if cid:
            context_parts.append(f"cid={cid[:8]}")
        cand_id = candidate_id_ctx.get()
        if cand_id:
            context_parts.append(f"candidate_id={cand_id}")
        if hasattr(record, "node_name"):
            context_parts.append(f"node={record.node_name}")

        ctx_str = f" [{', '.join(context_parts)}]" if context_parts else ""
        line = f"[{time_str}] [{level}] {logger_name}{ctx_str}: {msg}"

        if record.exc_info:
            exc_text = self.formatException(record.exc_info)
            line += f"\n{exc_text}"

        return line.replace("\r", "")

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

        return json.dumps(log_data, ensure_ascii=False).replace("\r", "")

def setup_logging(level: int = logging.INFO, log_format: str = None):
    """Configures system-wide root logger to emit readable logs in dev or JSON in production."""
    if log_format is None:
        log_format = os.getenv("LOG_FORMAT", "console" if os.getenv("ENV") != "production" else "json")

    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    # Clear existing handlers to prevent duplicate logging
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    stream_handler = logging.StreamHandler(sys.stdout)
    if log_format.lower() == "json":
        stream_handler.setFormatter(JSONFormatter())
    else:
        stream_handler.setFormatter(ConsoleFormatter())

    root_logger.addHandler(stream_handler)

    # Mute noisy 3rd-party loggers in dev (e.g. httpx Supabase auth requests)
    noisy_loggers = ["httpx", "httpcore", "urllib3", "asyncio"]
    for logger_name in noisy_loggers:
        logging.getLogger(logger_name).setLevel(logging.WARNING)

    # Re-route uvicorn & arq loggers to use root handlers so output style is unified & un-mangled
    for logger_name in ("uvicorn", "uvicorn.access", "uvicorn.error", "arq", "arq.worker", "arq.main", "arq.jobs"):
        lg = logging.getLogger(logger_name)
        lg.handlers = []
        lg.propagate = True

logger = logging.getLogger("recruitment_agent")


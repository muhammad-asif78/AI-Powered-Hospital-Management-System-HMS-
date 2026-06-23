"""
Structured JSON logging utility for Linear Health HMS.
Supports request-scoped contextual logging using Python contextvars.
"""

import json
import logging
import sys
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any, Dict

# ContextVar to store structured logging context dynamically (thread/task safe)
LOG_CONTEXT: ContextVar[Dict[str, Any]] = ContextVar("log_context", default={})


class StructuredJSONFormatter(logging.Formatter):
    """
    Production-grade JSON Formatter.
    Formats Python log records into structured JSON objects.
    """

    def format(self, record: logging.LogRecord) -> str:
        # Standard metadata payload
        payload: Dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc)
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "func_name": record.funcName,
            "line_no": record.lineno,
            "process_id": record.process,
            "thread_name": record.threadName,
        }

        # Merge dynamic context (e.g. request_id, room_id, patient_id) from ContextVar
        context = LOG_CONTEXT.get()
        if context:
            payload.update(context)

        # Merge attributes passed via extra={} dynamically
        standard_attrs = {
            "args",
            "asctime",
            "created",
            "exc_info",
            "exc_text",
            "filename",
            "funcName",
            "levelname",
            "levelno",
            "lineno",
            "module",
            "msecs",
            "message",
            "msg",
            "name",
            "pathname",
            "process",
            "processName",
            "relativeCreated",
            "stack_info",
            "thread",
            "threadName",
        }
        for key, value in record.__dict__.items():
            if key not in standard_attrs and not key.startswith("_"):
                payload[key] = value

        # Include exception info if available
        if record.exc_info:
            payload["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                "message": str(record.exc_info[1]) if record.exc_info[1] else "",
                "traceback": self.formatException(record.exc_info),
            }
        elif record.exc_text:
            payload["exception"] = {"message": record.exc_text}

        return json.dumps(payload)


def setup_structured_logging(log_level: int = logging.INFO):
    """
    Configure the root logger to output structured JSON logs.
    Redirects Uvicorn and FastAPI logs to output clean, unified JSON structure.
    """
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Remove existing handlers to avoid duplicate logs
    for handler in list(root_logger.handlers):
        root_logger.removeHandler(handler)

    # Standard out stream handler
    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(StructuredJSONFormatter())
    root_logger.addHandler(stream_handler)

    # Intercept logging from external web runners
    for logger_name in [
        "uvicorn",
        "uvicorn.access",
        "uvicorn.error",
        "fastapi",
        "gunicorn.error",
        "gunicorn.access",
    ]:
        lib_logger = logging.getLogger(logger_name)
        lib_logger.propagate = True
        lib_logger.handlers = []

    logging.getLogger("linear_health").info(
        "Structured JSON logging system initialized."
    )


# Context Managers/Helpers for ContextVar modification
def set_log_context(context: Dict[str, Any]):
    """Sets/updates the current log context."""
    current = LOG_CONTEXT.get().copy()
    current.update(context)
    LOG_CONTEXT.set(current)


def clear_log_context():
    """Clears all keys in the logging context."""
    LOG_CONTEXT.set({})


def remove_log_context_key(key: str):
    """Removes a specific key from the logging context."""
    current = LOG_CONTEXT.get().copy()
    if key in current:
        current.pop(key)
    LOG_CONTEXT.set(current)

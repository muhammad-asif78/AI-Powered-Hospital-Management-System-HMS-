"""
Structured JSON logging utility for Linear Health LiveKit Voice Agent.
Supports tracking RTC session metadata (room, participant_id, call_id).
"""

import json
import logging
import sys
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any, Dict

# Task-isolated context for tracking room and participant details
AGENT_CONTEXT: ContextVar[Dict[str, Any]] = ContextVar("agent_context", default={})


class AgentJSONFormatter(logging.Formatter):
    """Formats LiveKit Agent logs into indexed JSON objects."""

    def format(self, record: logging.LogRecord) -> str:
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
        }

        # Merge dynamic task context (e.g. room_name, participant_id)
        context = AGENT_CONTEXT.get()
        if context:
            payload.update(context)

        # Merge additional parameters passed via extra={}
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

        if record.exc_info:
            payload["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                "message": str(record.exc_info[1]) if record.exc_info[1] else "",
                "traceback": self.formatException(record.exc_info),
            }

        return json.dumps(payload)


def setup_agent_logging(log_level: int = logging.INFO):
    """Configures structured JSON logging for the LiveKit agent worker."""
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    for handler in list(root_logger.handlers):
        root_logger.removeHandler(handler)

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(AgentJSONFormatter())
    root_logger.addHandler(stream_handler)

    # Prevent library log pollution but propagate message logging through root
    for logger_name in ["livekit", "urllib3", "asyncio"]:
        lib_logger = logging.getLogger(logger_name)
        lib_logger.propagate = True
        lib_logger.handlers = []

    logging.getLogger("linear_health.agent").info(
        "Agent structured JSON logging initialized."
    )


def set_agent_context(context: Dict[str, Any]):
    """Appends keys to the current agent session log context."""
    current = AGENT_CONTEXT.get().copy()
    current.update(context)
    AGENT_CONTEXT.set(current)


def clear_agent_context():
    """Clears the agent session log context."""
    AGENT_CONTEXT.set({})

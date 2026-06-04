"""Custom middleware for request logging and global error handling."""

import time
import logging
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from app.logging_utils import set_log_context, clear_log_context

logger = logging.getLogger("linear_health")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Logs every incoming request with structured context (request_id, duration)."""

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", uuid.uuid4().hex)

        # Set contextual information for all logs in this request's lifetime
        set_log_context({
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "client_ip": request.client.host if request.client else None,
        })

        start = time.perf_counter()
        try:
            response = await call_next(request)
            duration_ms = (time.perf_counter() - start) * 1000

            logger.info(
                "HTTP request completed",
                extra={
                    "status_code": response.status_code,
                    "duration_ms": round(duration_ms, 2),
                },
            )
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Process-Time-Ms"] = f"{duration_ms:.1f}"
            return response
        finally:
            clear_log_context()


class GlobalErrorHandlerMiddleware(BaseHTTPMiddleware):
    """Catches unhandled exceptions and logs them with structured details."""

    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except Exception as exc:
            logger.error(
                "Unhandled system exception occurred",
                exc_info=exc,
            )
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal server error"},
            )

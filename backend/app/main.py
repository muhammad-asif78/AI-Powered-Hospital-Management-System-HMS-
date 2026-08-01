"""
Linear Health Hospital Management System — FastAPI Application Entry Point.

Configures CORS, custom middleware, and registers all API routers.
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.middleware import RequestLoggingMiddleware, GlobalErrorHandlerMiddleware
from app.routers import (
    auth,
    patients,
    doctors,
    appointments,
    referrals,
    prior_auth,
    users,
)
from app.routers.dashboard import insurance_router, dashboard_router
from app.routers import livekit_token
from app.services.redis_service import init_redis, close_redis
from fastapi.staticfiles import StaticFiles
import os

# ──────────────── Logging ────────────────

from app.logging_utils import setup_structured_logging

setup_structured_logging(logging.INFO)
logger = logging.getLogger("linear_health")


# ──────────────── Lifespan ────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create DB tables + Redis. Shutdown: cleanup."""
    logger.info("Starting %s (%s)", settings.APP_NAME, settings.APP_ENV)
    try:
        os.makedirs("static/avatars", exist_ok=True)
    except OSError:
        logger.warning(
            "Failed to create static/avatars directory. Read-only filesystem."
        )
    try:
        await init_db()
        logger.info("Database tables initialized")
    except Exception as exc:
        logger.error("Database connection failed during startup: %s", exc)
    try:
        await init_redis()
    except Exception as exc:
        logger.error("Redis connection failed during startup: %s", exc)
    yield
    try:
        await close_redis()
    except Exception:
        pass
    logger.info("Shutting down %s", settings.APP_NAME)



# ──────────────── App Instance ────────────────

app = FastAPI(
    title=settings.APP_NAME,
    description="AI-powered automation platform for clinics — Inbound/Outbound Referrals, Prior Authorization, AI Contact Center",
    version="1.0.0",
    lifespan=lifespan,
)


# ──────────────── Middleware Stack ────────────────

# Global error handler (outermost — catches everything)
app.add_middleware(GlobalErrorHandlerMiddleware)

# Request logging
app.add_middleware(RequestLoggingMiddleware)

# CORS — strictly configured
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def normalize_vercel_path(request, call_next):
    path_param = request.query_params.get("path")
    if path_param:
        target_path = path_param
    else:
        raw_path = request.scope.get("path", "")
        headers = dict(request.scope.get("headers", []))
        x_matched = headers.get(b"x-matched-path", b"").decode("utf-8")
        target_path = x_matched if x_matched else raw_path

    clean_path = target_path.split("?")[0].replace("/api/index.py", "").replace("/api/index", "")
    
    if not clean_path or clean_path == "/":
        clean_path = "/api/health"
    elif not clean_path.startswith("/api"):
        clean_path = "/api" + (clean_path if clean_path.startswith("/") else "/" + clean_path)
        
    request.scope["path"] = clean_path
    response = await call_next(request)
    return response




# ──────────────── Register Routers ────────────────

import os
from fastapi.responses import RedirectResponse, FileResponse

frontend_dist = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")
)
assets_dir = os.path.join(frontend_dist, "assets")
if os.path.exists(assets_dir):
    app.mount("/assets", StaticFiles(directory=assets_dir), name="frontend_assets")

app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(doctors.router)
app.include_router(appointments.router)
app.include_router(referrals.router)
app.include_router(prior_auth.router)
app.include_router(insurance_router)
app.include_router(dashboard_router)
app.include_router(livekit_token.router)
app.include_router(users.router)


# ──────────────── Health Check ────────────────


from fastapi import Request

@app.get("/api", tags=["Health"])
@app.get("/api/", tags=["Health"])
@app.get("/health", tags=["Health"])
@app.get("/api/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "service": settings.APP_NAME}

@app.get("/api/debug", tags=["Health"])
async def debug_info(request: Request):
    routes = [getattr(r, "path", str(r)) for r in app.routes]
    return {
        "url": str(request.url),
        "path": request.url.path,
        "headers": dict(request.headers),
        "routes": routes,
    }







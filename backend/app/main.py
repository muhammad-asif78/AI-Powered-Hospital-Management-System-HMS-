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
    await init_db()
    logger.info("Database tables initialized")
    await init_redis()
    yield
    await close_redis()
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


# ──────────────── Register Routers ────────────────

# Mount static files for user profile images
try:
    os.makedirs("static/avatars", exist_ok=True)
except OSError:
    pass
app.mount("/api/static", StaticFiles(directory="static"), name="static")

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


@app.get("/api/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "service": settings.APP_NAME}


@app.get("/")
async def root():
    return RedirectResponse(url="/docs")

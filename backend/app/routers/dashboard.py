"""Insurance provider routes and dashboard analytics."""

import json

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
from datetime import datetime, timezone
from app.database import get_db
from app.models import (
    InsuranceProvider,
    PatientInsurance,
    Patient,
    Doctor,
    Appointment,
    InboundReferral,
    PriorAuthorization,
    ContactCenterLog,
    ReferralStatus,
    PriorAuthStatus,
)
from app.schemas import (
    InsuranceProviderCreate,
    InsuranceProviderResponse,
    PatientInsuranceCreate,
    PatientInsuranceResponse,
    DashboardStats,
)
from app.security import get_current_user
from app.services.redis_service import get_cache, set_cache

# ──────────────── Insurance Routes ────────────────

insurance_router = APIRouter(prefix="/api/insurance", tags=["Insurance"])


@insurance_router.get("/providers", response_model=List[InsuranceProviderResponse])
async def list_providers(
    db: AsyncSession = Depends(get_db), _=Depends(get_current_user)
):
    result = await db.execute(
        select(InsuranceProvider).order_by(InsuranceProvider.name)
    )
    return result.scalars().all()


@insurance_router.post(
    "/providers", response_model=InsuranceProviderResponse, status_code=201
)
async def create_provider(
    data: InsuranceProviderCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    provider = InsuranceProvider(**data.model_dump())
    db.add(provider)
    await db.flush()
    await db.refresh(provider)
    return provider


@insurance_router.post(
    "/patient-insurance", response_model=PatientInsuranceResponse, status_code=201
)
async def add_patient_insurance(
    data: PatientInsuranceCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    record = PatientInsurance(**data.model_dump())
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return record


@insurance_router.get(
    "/patient/{patient_id}", response_model=List[PatientInsuranceResponse]
)
async def get_patient_insurance(
    patient_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)
):
    result = await db.execute(
        select(PatientInsurance).where(PatientInsurance.patient_id == patient_id)
    )
    return result.scalars().all()


# ──────────────── Dashboard Routes ────────────────

dashboard_router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@dashboard_router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db), _=Depends(get_current_user)
):
    """Aggregate statistics — cached in Redis for 60 seconds."""
    cached = await get_cache("dashboard:stats")
    if cached:
        return DashboardStats(**json.loads(cached))

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_patients = (await db.execute(select(func.count(Patient.id)))).scalar() or 0
    total_doctors = (await db.execute(select(func.count(Doctor.id)))).scalar() or 0
    total_appointments = (
        await db.execute(select(func.count(Appointment.id)))
    ).scalar() or 0

    pending_referrals = (
        await db.execute(
            select(func.count(InboundReferral.id)).where(
                InboundReferral.status == ReferralStatus.pending
            )
        )
    ).scalar() or 0

    pending_prior_auths = (
        await db.execute(
            select(func.count(PriorAuthorization.id)).where(
                PriorAuthorization.status.in_(
                    [PriorAuthStatus.draft, PriorAuthStatus.submitted]
                )
            )
        )
    ).scalar() or 0

    appointments_today = (
        await db.execute(
            select(func.count(Appointment.id)).where(
                Appointment.appointment_date >= today_start
            )
        )
    ).scalar() or 0

    ai_calls = (
        await db.execute(
            select(func.count(ContactCenterLog.id)).where(ContactCenterLog.ai_handled)
        )
    ).scalar() or 0

    referrals_month = (
        await db.execute(
            select(func.count(InboundReferral.id)).where(
                InboundReferral.created_at >= month_start
            )
        )
    ).scalar() or 0

    stats = DashboardStats(
        total_patients=total_patients,
        total_doctors=total_doctors,
        total_appointments=total_appointments,
        pending_referrals=pending_referrals,
        pending_prior_auths=pending_prior_auths,
        appointments_today=appointments_today,
        ai_calls_handled=ai_calls,
        referrals_this_month=referrals_month,
    )
    await set_cache("dashboard:stats", stats.model_dump(), ex=60)
    return stats

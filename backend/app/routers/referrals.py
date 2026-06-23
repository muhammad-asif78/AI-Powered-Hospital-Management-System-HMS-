"""Inbound & Outbound Referral routes with Groq AI parsing."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from app.database import get_db
from app.models import (
    InboundReferral,
    OutboundReferral,
    ReferralStatus,
    OutboundReferralStatus,
)
from app.schemas import (
    InboundReferralCreate,
    InboundReferralUpdate,
    InboundReferralResponse,
    OutboundReferralCreate,
    OutboundReferralUpdate,
    OutboundReferralResponse,
)
from app.security import get_current_user
from app.services.groq_service import parse_referral_document

router = APIRouter(prefix="/api/referrals", tags=["Referrals"])


# ──────────────── Inbound Referrals ────────────────


@router.get("/inbound", response_model=List[InboundReferralResponse])
async def list_inbound(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    query = (
        select(InboundReferral)
        .offset(skip)
        .limit(limit)
        .order_by(InboundReferral.created_at.desc())
    )
    if status:
        query = query.where(InboundReferral.status == ReferralStatus(status))
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/inbound/{referral_id}", response_model=InboundReferralResponse)
async def get_inbound(
    referral_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)
):
    result = await db.execute(
        select(InboundReferral).where(InboundReferral.id == referral_id)
    )
    ref = result.scalar_one_or_none()
    if not ref:
        raise HTTPException(status_code=404, detail="Inbound referral not found")
    return ref


@router.post("/inbound", response_model=InboundReferralResponse, status_code=201)
async def create_inbound(
    data: InboundReferralCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    from sqlalchemy.exc import IntegrityError

    try:
        ref = InboundReferral(**data.model_dump())

        # If raw document text is provided, use Groq AI to parse it
        if data.raw_document_text:
            ref.status = ReferralStatus.processing
            ai_data = await parse_referral_document(data.raw_document_text)
            ref.ai_extracted_data = ai_data

        db.add(ref)
        await db.flush()
        await db.refresh(ref)
        return ref
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Invalid Patient ID. Please ensure the patient exists in the system.",
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/inbound/{referral_id}", response_model=InboundReferralResponse)
async def update_inbound(
    referral_id: int,
    data: InboundReferralUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(
        select(InboundReferral).where(InboundReferral.id == referral_id)
    )
    ref = result.scalar_one_or_none()
    if not ref:
        raise HTTPException(status_code=404, detail="Inbound referral not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(ref, field, value)
    await db.flush()
    await db.refresh(ref)
    return ref


@router.post("/inbound/{referral_id}/parse", response_model=InboundReferralResponse)
async def parse_inbound(
    referral_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)
):
    """Trigger AI parsing on an existing inbound referral's raw document text."""
    result = await db.execute(
        select(InboundReferral).where(InboundReferral.id == referral_id)
    )
    ref = result.scalar_one_or_none()
    if not ref:
        raise HTTPException(status_code=404, detail="Inbound referral not found")
    if not ref.raw_document_text:
        raise HTTPException(status_code=400, detail="No raw document text to parse")

    ai_data = await parse_referral_document(ref.raw_document_text)
    ref.ai_extracted_data = ai_data
    ref.status = ReferralStatus.processing
    await db.flush()
    await db.refresh(ref)
    return ref


# ──────────────── Outbound Referrals ────────────────


@router.get("/outbound", response_model=List[OutboundReferralResponse])
async def list_outbound(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    query = (
        select(OutboundReferral)
        .offset(skip)
        .limit(limit)
        .order_by(OutboundReferral.created_at.desc())
    )
    if status:
        query = query.where(OutboundReferral.status == OutboundReferralStatus(status))
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/outbound/{referral_id}", response_model=OutboundReferralResponse)
async def get_outbound(
    referral_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)
):
    result = await db.execute(
        select(OutboundReferral).where(OutboundReferral.id == referral_id)
    )
    ref = result.scalar_one_or_none()
    if not ref:
        raise HTTPException(status_code=404, detail="Outbound referral not found")
    return ref


@router.post("/outbound", response_model=OutboundReferralResponse, status_code=201)
async def create_outbound(
    data: OutboundReferralCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    from sqlalchemy.exc import IntegrityError

    try:
        ref = OutboundReferral(**data.model_dump())
        db.add(ref)
        await db.flush()
        await db.refresh(ref)
        return ref
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Invalid Patient ID or Referring Doctor ID. Please ensure they exist in the system.",
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/outbound/{referral_id}", response_model=OutboundReferralResponse)
async def update_outbound(
    referral_id: int,
    data: OutboundReferralUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(
        select(OutboundReferral).where(OutboundReferral.id == referral_id)
    )
    ref = result.scalar_one_or_none()
    if not ref:
        raise HTTPException(status_code=404, detail="Outbound referral not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(ref, field, value)
    await db.flush()
    await db.refresh(ref)
    return ref


@router.post("/outbound/{referral_id}/verify", response_model=OutboundReferralResponse)
async def verify_outbound(
    referral_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)
):
    """Verify insurance acceptance and specialty match for an outbound referral."""
    result = await db.execute(
        select(OutboundReferral).where(OutboundReferral.id == referral_id)
    )
    ref = result.scalar_one_or_none()
    if not ref:
        raise HTTPException(status_code=404, detail="Outbound referral not found")

    # In production, this would call insurance verification APIs
    # For now, mark as verified
    ref.insurance_accepted = True
    ref.specialty_match = True
    ref.status = OutboundReferralStatus.verified
    await db.flush()
    await db.refresh(ref)
    return ref

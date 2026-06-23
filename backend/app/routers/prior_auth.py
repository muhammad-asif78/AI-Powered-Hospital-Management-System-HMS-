"""Prior Authorization routes with Groq AI classification."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from datetime import date
from app.database import get_db
from app.models import PriorAuthorization, PriorAuthStatus
from app.schemas import PriorAuthCreate, PriorAuthUpdate, PriorAuthResponse
from app.security import get_current_user
from app.services.groq_service import classify_prior_auth

router = APIRouter(prefix="/api/prior-auth", tags=["Prior Authorization"])


@router.get("/", response_model=List[PriorAuthResponse])
async def list_prior_auths(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    patient_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    query = (
        select(PriorAuthorization)
        .offset(skip)
        .limit(limit)
        .order_by(PriorAuthorization.created_at.desc())
    )
    if status:
        query = query.where(PriorAuthorization.status == PriorAuthStatus(status))
    if patient_id:
        query = query.where(PriorAuthorization.patient_id == patient_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{pa_id}", response_model=PriorAuthResponse)
async def get_prior_auth(
    pa_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)
):
    result = await db.execute(
        select(PriorAuthorization).where(PriorAuthorization.id == pa_id)
    )
    pa = result.scalar_one_or_none()
    if not pa:
        raise HTTPException(status_code=404, detail="Prior authorization not found")
    return pa


@router.post("/", response_model=PriorAuthResponse, status_code=201)
async def create_prior_auth(
    data: PriorAuthCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    from sqlalchemy.exc import IntegrityError

    try:
        pa = PriorAuthorization(**data.model_dump())
        db.add(pa)
        await db.flush()
        await db.refresh(pa)
        return pa
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Invalid Patient ID, Doctor ID, or Insurance Provider ID. Please ensure they exist.",
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{pa_id}", response_model=PriorAuthResponse)
async def update_prior_auth(
    pa_id: int,
    data: PriorAuthUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(
        select(PriorAuthorization).where(PriorAuthorization.id == pa_id)
    )
    pa = result.scalar_one_or_none()
    if not pa:
        raise HTTPException(status_code=404, detail="Prior authorization not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(pa, field, value)
    await db.flush()
    await db.refresh(pa)
    return pa


@router.post("/{pa_id}/classify", response_model=PriorAuthResponse)
async def ai_classify_prior_auth(
    pa_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)
):
    """Use Groq AI to predict approval likelihood and generate clinical justification."""
    result = await db.execute(
        select(PriorAuthorization).where(PriorAuthorization.id == pa_id)
    )
    pa = result.scalar_one_or_none()
    if not pa:
        raise HTTPException(status_code=404, detail="Prior authorization not found")

    ai_result = await classify_prior_auth(
        procedure_code=pa.procedure_code,
        procedure_description=pa.procedure_description,
        diagnosis_code=pa.diagnosis_code,
        clinical_justification=pa.clinical_justification or "",
    )

    pa.ai_predicted_status = str(ai_result.get("predicted_status", "unknown"))
    justification = ai_result.get("generated_justification", "")
    if isinstance(justification, dict):
        justification = justification.get(
            "text",
            justification.get(
                "letter", justification.get("content", str(justification))
            ),
        )
    pa.ai_generated_justification = str(justification)
    await db.flush()
    await db.refresh(pa)
    return pa


@router.post("/{pa_id}/submit", response_model=PriorAuthResponse)
async def submit_prior_auth(
    pa_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)
):
    """Submit a prior authorization for review."""
    result = await db.execute(
        select(PriorAuthorization).where(PriorAuthorization.id == pa_id)
    )
    pa = result.scalar_one_or_none()
    if not pa:
        raise HTTPException(status_code=404, detail="Prior authorization not found")
    if pa.status not in (PriorAuthStatus.draft,):
        raise HTTPException(status_code=400, detail="Can only submit from draft status")

    pa.status = PriorAuthStatus.submitted
    pa.submitted_date = date.today()
    await db.flush()
    await db.refresh(pa)
    return pa

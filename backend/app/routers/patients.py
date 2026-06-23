"""Patient CRUD routes."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from app.database import get_db
from app.models import Patient
from app.schemas import PatientCreate, PatientUpdate, PatientResponse
from app.security import get_current_user

router = APIRouter(prefix="/api/patients", tags=["Patients"])


@router.get("/", response_model=List[PatientResponse])
async def list_patients(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    query = (
        select(Patient).offset(skip).limit(limit).order_by(Patient.created_at.desc())
    )
    if search:
        search_clean = search.strip()
        query = query.where(
            Patient.first_name.ilike(f"%{search_clean}%")
            | Patient.last_name.ilike(f"%{search_clean}%")
            | Patient.medical_record_number.ilike(f"%{search_clean}%")
            | (Patient.first_name + " " + Patient.last_name).ilike(f"%{search_clean}%")
        )
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/count")
async def count_patients(
    db: AsyncSession = Depends(get_db), _=Depends(get_current_user)
):
    result = await db.execute(select(func.count(Patient.id)))
    return {"count": result.scalar()}


@router.get("/{patient_id}", response_model=PatientResponse)
async def get_patient(
    patient_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)
):
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.post("/", response_model=PatientResponse, status_code=201)
async def create_patient(
    data: PatientCreate, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)
):
    # Check for duplicate MRN
    existing = await db.execute(
        select(Patient).where(
            Patient.medical_record_number == data.medical_record_number
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400, detail="Medical record number already exists"
        )

    # Check for duplicate email
    if data.email:
        existing_email = await db.execute(
            select(Patient).where(Patient.email == data.email)
        )
        if existing_email.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already registered")

    patient = Patient(**data.model_dump())
    db.add(patient)
    await db.flush()
    await db.refresh(patient)
    return patient


@router.put("/{patient_id}", response_model=PatientResponse)
async def update_patient(
    patient_id: int,
    data: PatientUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(patient, field, value)
    await db.flush()
    await db.refresh(patient)
    return patient


@router.delete("/{patient_id}", status_code=204)
async def delete_patient(
    patient_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)
):
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    await db.delete(patient)

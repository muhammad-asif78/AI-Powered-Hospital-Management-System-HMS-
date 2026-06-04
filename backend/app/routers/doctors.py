"""Doctor CRUD routes."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from app.database import get_db
from app.models import Doctor
from app.schemas import DoctorCreate, DoctorUpdate, DoctorResponse
from app.security import get_current_user

router = APIRouter(prefix="/api/doctors", tags=["Doctors"])


@router.get("/", response_model=List[DoctorResponse])
async def list_doctors(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    specialty: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    query = select(Doctor).offset(skip).limit(limit).order_by(Doctor.last_name)
    if specialty:
        query = query.where(Doctor.specialty.ilike(f"%{specialty}%"))
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{doctor_id}", response_model=DoctorResponse)
async def get_doctor(doctor_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(Doctor).where(Doctor.id == doctor_id))
    doctor = result.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return doctor


@router.post("/", response_model=DoctorResponse, status_code=201)
async def create_doctor(data: DoctorCreate, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    existing = await db.execute(select(Doctor).where(Doctor.license_number == data.license_number))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="License number already exists")
    doctor = Doctor(**data.model_dump())
    db.add(doctor)
    await db.flush()
    await db.refresh(doctor)
    return doctor


@router.put("/{doctor_id}", response_model=DoctorResponse)
async def update_doctor(
    doctor_id: int, data: DoctorUpdate, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)
):
    result = await db.execute(select(Doctor).where(Doctor.id == doctor_id))
    doctor = result.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(doctor, field, value)
    await db.flush()
    await db.refresh(doctor)
    return doctor


@router.delete("/{doctor_id}", status_code=204)
async def delete_doctor(doctor_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(Doctor).where(Doctor.id == doctor_id))
    doctor = result.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    await db.delete(doctor)

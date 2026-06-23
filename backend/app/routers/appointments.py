"""Appointment CRUD routes (N:M junction between patients and doctors)."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from app.database import get_db
from app.models import Appointment, AppointmentStatus
from app.schemas import AppointmentCreate, AppointmentUpdate, AppointmentResponse
from app.security import get_current_user

router = APIRouter(prefix="/api/appointments", tags=["Appointments"])


@router.get("/", response_model=List[AppointmentResponse])
async def list_appointments(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    patient_id: Optional[int] = None,
    doctor_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    query = (
        select(Appointment)
        .offset(skip)
        .limit(limit)
        .order_by(Appointment.appointment_date.desc())
    )
    if status:
        query = query.where(Appointment.status == AppointmentStatus(status))
    if patient_id:
        query = query.where(Appointment.patient_id == patient_id)
    if doctor_id:
        query = query.where(Appointment.doctor_id == doctor_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{appointment_id}", response_model=AppointmentResponse)
async def get_appointment(
    appointment_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)
):
    result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appt


@router.post("/", response_model=AppointmentResponse, status_code=201)
async def create_appointment(
    data: AppointmentCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    from sqlalchemy.exc import IntegrityError

    try:
        appt = Appointment(**data.model_dump())
        db.add(appt)
        await db.flush()
        await db.refresh(appt)
        return appt
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Invalid Patient ID or Doctor ID. Please ensure they exist in the system.",
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{appointment_id}", response_model=AppointmentResponse)
async def update_appointment(
    appointment_id: int,
    data: AppointmentUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(appt, field, value)
    await db.flush()
    await db.refresh(appt)
    return appt


@router.delete("/{appointment_id}", status_code=204)
async def delete_appointment(
    appointment_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)
):
    result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    await db.delete(appt)

"""
SQLAlchemy ORM Models — Linear Health Hospital Management System.

Tables: users, patients, doctors, insurance_providers, patient_insurance,
        appointments, inbound_referrals, outbound_referrals,
        prior_authorizations, contact_center_logs
"""

import enum
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Date, DateTime,
    ForeignKey, Enum, JSON, Float,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


# ──────────────────── Enums ────────────────────

class UserRole(str, enum.Enum):
    admin = "admin"
    doctor = "doctor"
    staff = "staff"


class Gender(str, enum.Enum):
    male = "male"
    female = "female"
    other = "other"


class AppointmentStatus(str, enum.Enum):
    scheduled = "scheduled"
    completed = "completed"
    cancelled = "cancelled"
    no_show = "no_show"


class ReferralStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    accepted = "accepted"
    rejected = "rejected"


class OutboundReferralStatus(str, enum.Enum):
    draft = "draft"
    pending_verification = "pending_verification"
    verified = "verified"
    sent = "sent"
    accepted = "accepted"
    rejected = "rejected"


class PriorAuthStatus(str, enum.Enum):
    draft = "draft"
    submitted = "submitted"
    under_review = "under_review"
    approved = "approved"
    denied = "denied"
    appeal = "appeal"


class CallType(str, enum.Enum):
    inbound = "inbound"
    outbound = "outbound"


# ──────────────────── Core Tables ────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.staff)
    is_active = Column(Boolean, default=True)
    avatar_url = Column(String(255), nullable=True)
    professional_title = Column(String(255), nullable=True)
    bio = Column(Text, nullable=True)
    two_factor_enabled = Column(Boolean, default=False)
    session_autolock = Column(Boolean, default=False)
    preferences = Column(JSON, nullable=True)
    billing_plan = Column(String(255), nullable=True, default="Enterprise Clinical Plan")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # 1:1 relationship
    doctor_profile = relationship("Doctor", back_populates="user", uselist=False)


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    date_of_birth = Column(Date, nullable=False)
    gender = Column(Enum(Gender), nullable=True)
    email = Column(String(255), unique=True, index=True)
    phone = Column(String(20))
    address = Column(Text)
    medical_record_number = Column(String(50), unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # 1:N relationships
    insurance_records = relationship("PatientInsurance", back_populates="patient", cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="patient")
    inbound_referrals = relationship("InboundReferral", back_populates="patient")
    outbound_referrals = relationship("OutboundReferral", back_populates="patient")
    prior_authorizations = relationship("PriorAuthorization", back_populates="patient")
    contact_center_logs = relationship("ContactCenterLog", back_populates="patient")


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    specialty = Column(String(100), nullable=False)
    license_number = Column(String(50), unique=True, nullable=False)
    phone = Column(String(20))
    email = Column(String(255), unique=True, index=True)
    is_accepting_patients = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    available_timings = Column(String(255), nullable=True)
    fees = Column(Float, nullable=True)

    # Relationships
    user = relationship("User", back_populates="doctor_profile")
    appointments = relationship("Appointment", back_populates="doctor")
    outbound_referrals = relationship("OutboundReferral", back_populates="referring_doctor")
    assigned_inbound_referrals = relationship("InboundReferral", back_populates="assigned_doctor")
    prior_authorizations = relationship("PriorAuthorization", back_populates="doctor")


# ──────────────────── Insurance Tables ────────────────────

class InsuranceProvider(Base):
    __tablename__ = "insurance_providers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False)
    plan_type = Column(String(100))
    contact_phone = Column(String(20))
    contact_email = Column(String(255))
    is_active = Column(Boolean, default=True)

    patient_records = relationship("PatientInsurance", back_populates="insurance_provider")
    prior_authorizations = relationship("PriorAuthorization", back_populates="insurance_provider")


class PatientInsurance(Base):
    """Junction-style table linking patients to their insurance coverage."""
    __tablename__ = "patient_insurance"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    insurance_provider_id = Column(Integer, ForeignKey("insurance_providers.id"), nullable=False)
    policy_number = Column(String(100), nullable=False)
    group_number = Column(String(100))
    subscriber_name = Column(String(255))
    is_primary = Column(Boolean, default=True)
    effective_date = Column(Date)
    expiration_date = Column(Date)

    patient = relationship("Patient", back_populates="insurance_records")
    insurance_provider = relationship("InsuranceProvider", back_populates="patient_records")


# ──────────────────── Appointment (N:M Junction) ────────────────────

class Appointment(Base):
    """Many-to-Many junction table linking patients and doctors."""
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    appointment_date = Column(DateTime(timezone=True), nullable=False)
    duration_minutes = Column(Integer, default=30)
    status = Column(Enum(AppointmentStatus), default=AppointmentStatus.scheduled)
    reason = Column(Text)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    patient = relationship("Patient", back_populates="appointments")
    doctor = relationship("Doctor", back_populates="appointments")


# ──────────────────── Referral Workflow Tables ────────────────────

class InboundReferral(Base):
    __tablename__ = "inbound_referrals"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=True)
    referring_provider_name = Column(String(255), nullable=False)
    referring_provider_npi = Column(String(20))
    referring_facility = Column(String(255))
    referral_date = Column(Date, nullable=False)
    reason = Column(Text, nullable=False)
    clinical_notes = Column(Text)
    raw_document_text = Column(Text)
    ai_extracted_data = Column(JSON)
    status = Column(Enum(ReferralStatus), default=ReferralStatus.pending)
    assigned_doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=True)
    insurance_verified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    patient = relationship("Patient", back_populates="inbound_referrals")
    assigned_doctor = relationship("Doctor", back_populates="assigned_inbound_referrals")


class OutboundReferral(Base):
    __tablename__ = "outbound_referrals"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    referring_doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    referred_to_provider = Column(String(255), nullable=False)
    referred_to_facility = Column(String(255))
    referred_to_specialty = Column(String(100), nullable=False)
    referral_date = Column(Date, nullable=False)
    reason = Column(Text, nullable=False)
    clinical_summary = Column(Text)
    insurance_accepted = Column(Boolean)
    specialty_match = Column(Boolean)
    status = Column(Enum(OutboundReferralStatus), default=OutboundReferralStatus.draft)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    patient = relationship("Patient", back_populates="outbound_referrals")
    referring_doctor = relationship("Doctor", back_populates="outbound_referrals")


# ──────────────────── Prior Authorization ────────────────────

class PriorAuthorization(Base):
    __tablename__ = "prior_authorizations"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    insurance_provider_id = Column(Integer, ForeignKey("insurance_providers.id"), nullable=False)
    procedure_code = Column(String(20), nullable=False)
    procedure_description = Column(Text, nullable=False)
    diagnosis_code = Column(String(20), nullable=False)
    clinical_justification = Column(Text)
    ai_generated_justification = Column(Text)
    status = Column(Enum(PriorAuthStatus), default=PriorAuthStatus.draft)
    ai_predicted_status = Column(String(50))
    submitted_date = Column(Date)
    decision_date = Column(Date)
    auth_number = Column(String(50))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    patient = relationship("Patient", back_populates="prior_authorizations")
    doctor = relationship("Doctor", back_populates="prior_authorizations")
    insurance_provider = relationship("InsuranceProvider", back_populates="prior_authorizations")


# ──────────────────── Contact Center Logs ────────────────────

class ContactCenterLog(Base):
    __tablename__ = "contact_center_logs"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=True)
    call_type = Column(Enum(CallType), nullable=False)
    caller_phone = Column(String(20))
    call_start = Column(DateTime(timezone=True))
    call_end = Column(DateTime(timezone=True))
    duration_seconds = Column(Integer)
    ai_handled = Column(Boolean, default=True)
    transcript = Column(Text)
    summary = Column(Text)
    action_taken = Column(String(255))
    escalated_to_human = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    patient = relationship("Patient", back_populates="contact_center_logs")

"""
Pydantic schemas for request/response validation — Linear Health HMS.
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Any
from datetime import date, datetime
from enum import Enum


# ──────────────────── Enums ────────────────────


class UserRoleEnum(str, Enum):
    admin = "admin"
    doctor = "doctor"
    staff = "staff"


class GenderEnum(str, Enum):
    male = "male"
    female = "female"
    other = "other"


class AppointmentStatusEnum(str, Enum):
    scheduled = "scheduled"
    completed = "completed"
    cancelled = "cancelled"
    no_show = "no_show"


class ReferralStatusEnum(str, Enum):
    pending = "pending"
    processing = "processing"
    accepted = "accepted"
    rejected = "rejected"


class OutboundReferralStatusEnum(str, Enum):
    draft = "draft"
    pending_verification = "pending_verification"
    verified = "verified"
    sent = "sent"
    accepted = "accepted"
    rejected = "rejected"


class PriorAuthStatusEnum(str, Enum):
    draft = "draft"
    submitted = "submitted"
    under_review = "under_review"
    approved = "approved"
    denied = "denied"
    appeal = "appeal"


class CallTypeEnum(str, Enum):
    inbound = "inbound"
    outbound = "outbound"


# ──────────────────── Auth ────────────────────


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str
    role: UserRoleEnum = UserRoleEnum.staff


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: UserRoleEnum
    is_active: bool
    avatar_url: Optional[str] = None
    professional_title: Optional[str] = None
    bio: Optional[str] = None
    two_factor_enabled: Optional[bool] = False
    session_autolock: Optional[bool] = False
    preferences: Optional[Any] = None
    billing_plan: Optional[str] = "Enterprise Clinical Plan"
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ──────────────────── Patient ────────────────────


class PatientCreate(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: date
    gender: Optional[GenderEnum] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    medical_record_number: str


class PatientUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[GenderEnum] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class PatientResponse(BaseModel):
    id: int
    first_name: str
    last_name: str
    date_of_birth: date
    gender: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    address: Optional[str]
    medical_record_number: str
    created_at: datetime

    class Config:
        from_attributes = True


# ──────────────────── Doctor ────────────────────


class DoctorCreate(BaseModel):
    first_name: str
    last_name: str
    specialty: str
    license_number: str
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    is_accepting_patients: bool = True
    user_id: Optional[int] = None
    available_timings: Optional[str] = None
    fees: Optional[float] = None


class DoctorUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    specialty: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    is_accepting_patients: Optional[bool] = None
    available_timings: Optional[str] = None
    fees: Optional[float] = None


class DoctorResponse(BaseModel):
    id: int
    first_name: str
    last_name: str
    specialty: str
    license_number: str
    phone: Optional[str]
    email: Optional[str]
    is_accepting_patients: bool
    created_at: datetime
    available_timings: Optional[str] = None
    fees: Optional[float] = None

    class Config:
        from_attributes = True


# ──────────────────── Insurance ────────────────────


class InsuranceProviderCreate(BaseModel):
    name: str
    plan_type: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[EmailStr] = None


class InsuranceProviderResponse(BaseModel):
    id: int
    name: str
    plan_type: Optional[str]
    contact_phone: Optional[str]
    contact_email: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True


class PatientInsuranceCreate(BaseModel):
    patient_id: int
    insurance_provider_id: int
    policy_number: str
    group_number: Optional[str] = None
    subscriber_name: Optional[str] = None
    is_primary: bool = True
    effective_date: Optional[date] = None
    expiration_date: Optional[date] = None


class PatientInsuranceResponse(BaseModel):
    id: int
    patient_id: int
    insurance_provider_id: int
    policy_number: str
    group_number: Optional[str]
    subscriber_name: Optional[str]
    is_primary: bool
    effective_date: Optional[date]
    expiration_date: Optional[date]

    class Config:
        from_attributes = True


# ──────────────────── Appointment ────────────────────


class AppointmentCreate(BaseModel):
    patient_id: int
    doctor_id: int
    appointment_date: datetime
    duration_minutes: int = 30
    reason: Optional[str] = None
    notes: Optional[str] = None


class AppointmentUpdate(BaseModel):
    appointment_date: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    status: Optional[AppointmentStatusEnum] = None
    reason: Optional[str] = None
    notes: Optional[str] = None


class AppointmentResponse(BaseModel):
    id: int
    patient_id: int
    doctor_id: int
    appointment_date: datetime
    duration_minutes: int
    status: str
    reason: Optional[str]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ──────────────────── Inbound Referral ────────────────────


class InboundReferralCreate(BaseModel):
    referring_provider_name: str
    referring_provider_npi: Optional[str] = None
    referring_facility: Optional[str] = None
    referral_date: date
    reason: str
    clinical_notes: Optional[str] = None
    raw_document_text: Optional[str] = None
    patient_id: Optional[int] = None
    assigned_doctor_id: Optional[int] = None


class InboundReferralUpdate(BaseModel):
    status: Optional[ReferralStatusEnum] = None
    patient_id: Optional[int] = None
    assigned_doctor_id: Optional[int] = None
    insurance_verified: Optional[bool] = None


class InboundReferralResponse(BaseModel):
    id: int
    patient_id: Optional[int]
    referring_provider_name: str
    referring_provider_npi: Optional[str]
    referring_facility: Optional[str]
    referral_date: date
    reason: str
    clinical_notes: Optional[str]
    raw_document_text: Optional[str]
    ai_extracted_data: Optional[Any]
    status: str
    assigned_doctor_id: Optional[int]
    insurance_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ──────────────────── Outbound Referral ────────────────────


class OutboundReferralCreate(BaseModel):
    patient_id: int
    referring_doctor_id: int
    referred_to_provider: str
    referred_to_facility: Optional[str] = None
    referred_to_specialty: str
    referral_date: date
    reason: str
    clinical_summary: Optional[str] = None


class OutboundReferralUpdate(BaseModel):
    status: Optional[OutboundReferralStatusEnum] = None
    insurance_accepted: Optional[bool] = None
    specialty_match: Optional[bool] = None


class OutboundReferralResponse(BaseModel):
    id: int
    patient_id: int
    referring_doctor_id: int
    referred_to_provider: str
    referred_to_facility: Optional[str]
    referred_to_specialty: str
    referral_date: date
    reason: str
    clinical_summary: Optional[str]
    insurance_accepted: Optional[bool]
    specialty_match: Optional[bool]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# ──────────────────── Prior Authorization ────────────────────


class PriorAuthCreate(BaseModel):
    patient_id: int
    doctor_id: int
    insurance_provider_id: int
    procedure_code: str
    procedure_description: str
    diagnosis_code: str
    clinical_justification: Optional[str] = None


class PriorAuthUpdate(BaseModel):
    status: Optional[PriorAuthStatusEnum] = None
    clinical_justification: Optional[str] = None
    auth_number: Optional[str] = None
    notes: Optional[str] = None


class PriorAuthResponse(BaseModel):
    id: int
    patient_id: int
    doctor_id: int
    insurance_provider_id: int
    procedure_code: str
    procedure_description: str
    diagnosis_code: str
    clinical_justification: Optional[str]
    ai_generated_justification: Optional[str]
    status: str
    ai_predicted_status: Optional[str]
    submitted_date: Optional[date]
    decision_date: Optional[date]
    auth_number: Optional[str]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ──────────────────── Contact Center ────────────────────


class ContactCenterLogCreate(BaseModel):
    patient_id: Optional[int] = None
    call_type: CallTypeEnum
    caller_phone: Optional[str] = None


class ContactCenterLogResponse(BaseModel):
    id: int
    patient_id: Optional[int]
    call_type: str
    caller_phone: Optional[str]
    call_start: Optional[datetime]
    call_end: Optional[datetime]
    duration_seconds: Optional[int]
    ai_handled: bool
    transcript: Optional[str]
    summary: Optional[str]
    action_taken: Optional[str]
    escalated_to_human: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ──────────────────── Dashboard ────────────────────


class DashboardStats(BaseModel):
    total_patients: int
    total_doctors: int
    total_appointments: int
    pending_referrals: int
    pending_prior_auths: int
    appointments_today: int
    ai_calls_handled: int
    referrals_this_month: int

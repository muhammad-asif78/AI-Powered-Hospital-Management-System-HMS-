"""User profile, settings, billing, security and notifications endpoints."""

import os
import shutil
from typing import Optional, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.database import get_db
from app.models import User
from app.schemas import UserResponse
from app.security import get_current_user, hash_password, verify_password

router = APIRouter(prefix="/api/users", tags=["Users"])


# --- Schemas ---


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    professional_title: Optional[str] = None
    bio: Optional[str] = None
    preferences: Optional[Any] = None


class SecurityUpdate(BaseModel):
    current_password: Optional[str] = None
    new_password: Optional[str] = Field(None, min_length=6)
    two_factor_enabled: Optional[bool] = None
    session_autolock: Optional[bool] = None


# --- Routes ---


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    data: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update general info and preferences for the current logged-in user."""
    if data.full_name is not None:
        current_user.full_name = data.full_name
    if data.professional_title is not None:
        current_user.professional_title = data.professional_title
    if data.bio is not None:
        current_user.bio = data.bio
    if data.preferences is not None:
        current_user.preferences = data.preferences

    await db.flush()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Handle user workstation photo uploads via multipart/form-data."""
    # Ensure static directory exists
    os.makedirs("static/avatars", exist_ok=True)

    # Save the file locally
    file_ext = os.path.splitext(file.filename)[1]
    filename = f"avatar_{current_user.id}{file_ext}"
    filepath = os.path.join("static/avatars", filename)

    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    current_user.avatar_url = f"/api/static/avatars/{filename}"
    await db.flush()
    await db.refresh(current_user)
    return {"avatar_url": current_user.avatar_url}


@router.put("/security", response_model=UserResponse)
async def update_security(
    data: SecurityUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update security credentials and preferences for the workstation."""
    # Handle password change
    if data.new_password is not None:
        if not data.current_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is required to set a new password.",
            )
        if not verify_password(data.current_password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incorrect current password.",
            )
        current_user.hashed_password = hash_password(data.new_password)

    # Handle 2FA and Session Autolock
    if data.two_factor_enabled is not None:
        current_user.two_factor_enabled = data.two_factor_enabled
    if data.session_autolock is not None:
        current_user.session_autolock = data.session_autolock

    await db.flush()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.get("/billing")
async def get_billing(current_user: User = Depends(get_current_user)):
    """Fetch user subscription, billing cycles and invoices."""
    return {
        "plan_name": current_user.billing_plan or "Enterprise Clinical Plan",
        "price": "$499/mo",
        "features": [
            "Unlimited staff workstations",
            "Unlimited patient health records",
            "Advanced AI diagnostics suite",
            "24/7 Priority clinical support",
            "HIPAA compliant cloud storage",
        ],
        "billing_cycle": "Nov 12",
        "days_remaining": 24,
        "payment_method": {"type": "VISA", "last4": "4242"},
        "invoices": [
            {
                "id": "INV-2024-001",
                "date": "Oct 12, 2024",
                "amount": "$499.00",
                "status": "Paid",
            },
            {
                "id": "INV-2024-002",
                "date": "Sep 12, 2024",
                "amount": "$499.00",
                "status": "Paid",
            },
            {
                "id": "INV-2024-003",
                "date": "Aug 12, 2024",
                "amount": "$499.00",
                "status": "Paid",
            },
        ],
    }


@router.get("/notifications")
async def get_notifications(current_user: User = Depends(get_current_user)):
    """Retrieve dynamic clinical notifications and features."""
    return [
        {
            "id": 1,
            "title": "Clinical Registry Audit",
            "message": "A routine automated check of patient registries has completed successfully.",
            "time": "2 hours ago",
            "unread": True,
        },
        {
            "id": 2,
            "title": "Prior Auth Approval",
            "message": "Prior auth request PA-9082 for Patient John Doe has been approved by provider.",
            "time": "4 hours ago",
            "unread": True,
        },
        {
            "id": 3,
            "title": "AI Diagnostics Active",
            "message": "Workstation diagnostics updated. Custom search debounce configured at 300ms.",
            "time": "1 day ago",
            "unread": False,
        },
    ]

"""Kurinda database models (SQLModel table definitions)."""
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UserRole(str, Enum):
    district_officer = "district_officer"
    chw_supervisor = "chw_supervisor"
    chw = "chw"


class User(SQLModel, table=True):
    """
    An account for one of Kurinda's three user types.

    District Officers are scoped to a district (e.g. "Musanze"); CHW
    Supervisors and CHWs are scoped to a sector within a district (e.g.
    "Kinigi") — both fields are validated against the real 422-sector list
    at registration, not free text, so dashboard scoping never silently
    breaks on a typo.
    """

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str = Field(unique=True, index=True)
    hashed_password: str
    role: UserRole
    district: Optional[str] = None
    sector: Optional[str] = None
    created_at: datetime = Field(default_factory=_utcnow)


class SmsAlertLog(SQLModel, table=True):
    """One row per sector alerted by a POST /alerts/send call."""

    id: Optional[int] = Field(default=None, primary_key=True)
    sector: str
    district: Optional[str] = None
    province: Optional[str] = None
    risk_value: Optional[float] = None
    recipient: str
    status: str  # "sent" | "failed"
    provider_message_id: Optional[str] = None
    error: Optional[str] = None
    sent_at: datetime = Field(default_factory=_utcnow)

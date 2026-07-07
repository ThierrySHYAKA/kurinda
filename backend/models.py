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
    """An account for one of Kurinda's three user types."""

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str = Field(unique=True, index=True)
    hashed_password: str
    role: UserRole
    district: Optional[str] = None  # optional home district, for future scoping
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

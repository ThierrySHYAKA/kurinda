"""Kurinda database models (SQLModel table definitions)."""
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


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

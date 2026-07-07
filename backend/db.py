"""
Kurinda database layer (Neon Postgres).

Reads DATABASE_URL from the environment. If it is not set, `engine` stays
None and callers fall back to running without persistence — this keeps the
API usable in local dev without a database, the same graceful-degradation
pattern already used for the Africa's Talking SMS credentials in main.py.
"""
import os
from typing import Optional

from sqlmodel import SQLModel, create_engine, Session

DATABASE_URL = os.getenv("DATABASE_URL")


def _normalize(url: Optional[str]) -> Optional[str]:
    """Rewrite a plain postgresql:// URL to use the psycopg (v3) driver."""
    if not url:
        return None
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    if url.startswith("postgresql://") and "+psycopg" not in url:
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


engine = create_engine(_normalize(DATABASE_URL), pool_pre_ping=True) if DATABASE_URL else None


def init_db() -> None:
    """Create tables that don't exist yet. No-op if DATABASE_URL is unset."""
    if engine is not None:
        SQLModel.metadata.create_all(engine)


def get_session():
    if engine is None:
        raise RuntimeError("DATABASE_URL is not configured")
    with Session(engine) as session:
        yield session

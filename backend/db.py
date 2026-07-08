"""
Kurinda database layer (Neon Postgres).

Reads DATABASE_URL from the environment. If it is not set, `engine` stays
None and callers fall back to running without persistence — this keeps the
API usable in local dev without a database, the same graceful-degradation
pattern already used for the Africa's Talking SMS credentials in main.py.
"""
import os
from typing import Optional

from sqlalchemy import text
from sqlmodel import SQLModel, create_engine, Session

DATABASE_URL = os.getenv("DATABASE_URL")

# Additive, idempotent column patches for tables that already existed in
# production before a column was added. create_all() only creates missing
# *tables*, never missing *columns* on a table that's already there — so a
# schema change like adding User.sector needs an explicit ALTER TABLE, run
# safely (IF NOT EXISTS) so it never touches or drops existing data.
_MIGRATIONS = [
    'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS sector VARCHAR',
]


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
    """Create tables that don't exist yet, then apply column patches. No-op
    if DATABASE_URL is unset."""
    if engine is None:
        return
    SQLModel.metadata.create_all(engine)
    with engine.begin() as conn:
        for statement in _MIGRATIONS:
            conn.execute(text(statement))


def get_session():
    if engine is None:
        raise RuntimeError("DATABASE_URL is not configured")
    with Session(engine) as session:
        yield session

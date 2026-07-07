"""
Kurinda Backend API
Machine learning early-warning system for village-level chronic childhood
stunting risk in Rwanda.
Project: BSc Software Engineering Capstone, African Leadership University
Author:  Thierry SHYAKA
Supervisor: Dirac MURAIRI
"""
import os
import json
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, SQLModel, select

# .env must be loaded before importing db/models: db.py reads DATABASE_URL
# from the environment at import time, so this has to run first.
try:
    from dotenv import load_dotenv
    load_dotenv()  # reads backend/.env locally; on Render env vars are set directly
except Exception:
    pass

from db import engine, init_db
from models import SmsAlertLog, User, UserRole
from auth import create_access_token, get_current_user, hash_password, verify_password

# -------------------------------------------------------------------------
# App initialization
# -------------------------------------------------------------------------
app = FastAPI(
    title="Kurinda API",
    description=(
        "Machine learning early-warning system for predicting village-level "
        "chronic childhood stunting risk in Rwanda using multi-source data fusion."
    ),
    version="0.1.0",
)

# -------------------------------------------------------------------------
# CORS - allows the Next.js frontend to call this API from a browser.
# For now we allow all origins; in production we'll lock this down to the
# Render frontend URL only.
# -------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    """Create DB tables if DATABASE_URL is configured. No-op otherwise."""
    init_db()

# -------------------------------------------------------------------------
# Data - the sector risk GeoJSON is loaded once at startup and cached in
# memory, so every request is served from RAM rather than re-reading disk.
# The file ships with the backend (backend/data/) so it is present on Render.
# It contains only aggregate rates and model predictions - no DHS microdata.
# -------------------------------------------------------------------------
DATA_DIR = Path(__file__).resolve().parent / "data"
SECTORS_GEOJSON = DATA_DIR / "sectors_risk.geojson"

_sectors_cache = None


def _load_sectors():
    """Load and cache the sector risk GeoJSON. Returns the parsed dict."""
    global _sectors_cache
    if _sectors_cache is None:
        if not SECTORS_GEOJSON.exists():
            raise FileNotFoundError(f"Missing data file: {SECTORS_GEOJSON}")
        with open(SECTORS_GEOJSON, "r", encoding="utf-8") as f:
            _sectors_cache = json.load(f)
    return _sectors_cache

# -------------------------------------------------------------------------
# Routes
# -------------------------------------------------------------------------
@app.get("/")
def root():
    """Landing endpoint - confirms the API is reachable."""
    return {
        "service": "Kurinda API",
        "version": "0.1.0",
        "status": "online",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    """Health check endpoint used by Render and monitoring tools."""
    return {"status": "ok"}


@app.get("/sectors")
def get_sectors():
    """
    Return the full 422-sector risk GeoJSON for the dashboard map.

    Each feature carries: GID_3, sector/district/province names, risk_value
    (0-1), is_high_risk, source (dhs_measurement_2019_20 | model_prediction),
    confidence_band, and the top-3 SHAP risk drivers plus one protective
    factor. Geometry is WGS84 (EPSG:4326) for Leaflet.
    """
    try:
        data = _load_sectors()
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="Sector data not available")
    return data


@app.get("/sectors/summary")
def get_sectors_summary():
    """
    Lightweight summary of the sector risk data - counts by source and
    risk class, without the heavy geometry payload. Useful for dashboard
    headline stats and for a quick health check of the data itself.
    """
    try:
        data = _load_sectors()
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="Sector data not available")

    features = data.get("features", [])
    total = len(features)
    high_risk = sum(1 for f in features
                    if f["properties"].get("is_high_risk") == 1)
    by_source = {}
    for f in features:
        src = f["properties"].get("source", "unknown")
        by_source[src] = by_source.get(src, 0) + 1

    return {
        "total_sectors": total,
        "high_risk_sectors": high_risk,
        "low_risk_sectors": total - high_risk,
        "by_source": by_source,
    }


# -------------------------------------------------------------------------
# Auth - role-based accounts (District Officer / CHW Supervisor / CHW).
# Self-signup: a user picks their role at registration, no admin step.
# Requires DATABASE_URL (users live in Postgres, not the in-memory GeoJSON).
# -------------------------------------------------------------------------
class RegisterRequest(SQLModel):
    name: str
    email: str
    password: str
    role: UserRole
    district: Optional[str] = None


class LoginRequest(SQLModel):
    email: str
    password: str


class UserPublic(SQLModel):
    id: int
    name: str
    email: str
    role: UserRole
    district: Optional[str] = None


class TokenResponse(SQLModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


def _require_db():
    if engine is None:
        raise HTTPException(status_code=503, detail="Database not configured")


@app.post("/auth/register", response_model=TokenResponse)
def register(payload: RegisterRequest):
    """Create an account and return an access token, same as /auth/login."""
    _require_db()
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    email = payload.email.strip().lower()
    with Session(engine) as session:
        existing = session.exec(select(User).where(User.email == email)).first()
        if existing:
            raise HTTPException(status_code=409, detail="An account with this email already exists")

        user = User(
            name=payload.name.strip(),
            email=email,
            hashed_password=hash_password(payload.password),
            role=payload.role,
            district=payload.district,
        )
        session.add(user)
        session.commit()
        session.refresh(user)

        token = create_access_token(user.id, user.role.value)
        return TokenResponse(access_token=token, user=UserPublic(**user.model_dump()))


@app.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest):
    """Authenticate with email + password and return an access token."""
    _require_db()
    email = payload.email.strip().lower()
    with Session(engine) as session:
        user = session.exec(select(User).where(User.email == email)).first()
        if not user or not verify_password(payload.password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Incorrect email or password")

        token = create_access_token(user.id, user.role.value)
        return TokenResponse(access_token=token, user=UserPublic(**user.model_dump()))


@app.get("/auth/me", response_model=UserPublic)
def me(user: User = Depends(get_current_user)):
    """Return the account for the current access token."""
    return UserPublic(**user.model_dump())


# -------------------------------------------------------------------------
# SMS alerts (Africa's Talking) - Week 6
#
# POST /alerts/send scans the sector risk data for high-risk sectors and
# sends a Kinyarwanda alert SMS for each, to a single test recipient (the
# Africa's Talking sandbox simulator number). Credentials come from env vars
# (AT_USERNAME, AT_API_KEY, AT_TEST_NUMBER) - never hard-coded, never
# committed. On Render these are set in the service's Environment settings.
# -------------------------------------------------------------------------
AT_USERNAME = os.getenv("AT_USERNAME")
AT_API_KEY = os.getenv("AT_API_KEY")
AT_TEST_NUMBER = os.getenv("AT_TEST_NUMBER")


def _kinyarwanda_alert(sector_name: str) -> str:
    """Build the Kinyarwanda risk-alert message for one sector."""
    return (
        f"MUTUZO: Umudugudu wa {sector_name} uri mu kaga ko kwangirika "
        f"k'imirire mu mezi 3 ari imbere. Sura imiryango ifite abana bari "
        f"munsi y'imyaka 2. Subiza 1 wemeje."
    )


@app.post("/alerts/send")
def send_alerts(limit: int = 5):
    """
    Send Kinyarwanda risk-alert SMS for the highest-risk sectors.

    Query param `limit` caps how many sectors to alert (default 5) so a test
    run does not send hundreds of messages. All messages go to the single
    configured test number (sandbox simulator) in this build.

    Returns the list of sectors alerted and the provider response.
    """
    # Credentials must be configured.
    if not all([AT_USERNAME, AT_API_KEY, AT_TEST_NUMBER]):
        raise HTTPException(
            status_code=503,
            detail="SMS not configured (missing AT_USERNAME/AT_API_KEY/AT_TEST_NUMBER).",
        )

    # Load sectors and pick the highest-risk ones.
    try:
        data = _load_sectors()
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="Sector data not available")

    features = data.get("features", [])
    high_risk = [
        f["properties"]
        for f in features
        if f["properties"].get("is_high_risk") == 1
    ]
    high_risk.sort(key=lambda p: p.get("risk_value", 0), reverse=True)
    targets = high_risk[: max(0, limit)]

    if not targets:
        return {"sent": 0, "sectors": [], "detail": "No high-risk sectors found."}

    # Initialise Africa's Talking and send.
    import africastalking

    africastalking.initialize(AT_USERNAME, AT_API_KEY)
    sms = africastalking.SMS

    sent = []
    logs = []
    for p in targets:
        name = p.get("NAME_3", "unknown")
        message = _kinyarwanda_alert(name)
        try:
            resp = sms.send(message, [AT_TEST_NUMBER])
            sent.append({"sector": name, "status": "sent", "response": resp})
            message_id = None
            try:
                message_id = resp["SMSMessageData"]["Recipients"][0]["messageId"]
            except (KeyError, IndexError, TypeError):
                pass
            logs.append(SmsAlertLog(
                sector=name,
                district=p.get("NAME_2"),
                province=p.get("province_en"),
                risk_value=p.get("risk_value"),
                recipient=AT_TEST_NUMBER,
                status="sent",
                provider_message_id=message_id,
            ))
        except Exception as e:
            sent.append({"sector": name, "status": "failed", "error": str(e)})
            logs.append(SmsAlertLog(
                sector=name,
                district=p.get("NAME_2"),
                province=p.get("province_en"),
                risk_value=p.get("risk_value"),
                recipient=AT_TEST_NUMBER,
                status="failed",
                error=str(e),
            ))

    # Persist the send log if a database is configured; the endpoint still
    # works without one (DATABASE_URL unset), same as the SMS credentials.
    if engine is not None:
        with Session(engine) as session:
            session.add_all(logs)
            session.commit()

    return {
        "sent": sum(1 for s in sent if s["status"] == "sent"),
        "recipient": AT_TEST_NUMBER,
        "sectors": sent,
    }


@app.get("/alerts/history")
def get_alerts_history(limit: int = 50):
    """
    Return the most recent SMS alerts sent, newest first.

    Requires DATABASE_URL to be configured; returns 503 otherwise.
    """
    if engine is None:
        raise HTTPException(status_code=503, detail="Database not configured")

    with Session(engine) as session:
        rows = session.exec(
            select(SmsAlertLog).order_by(SmsAlertLog.sent_at.desc()).limit(limit)
        ).all()
        return rows

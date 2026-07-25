"""
Kurinda Backend API
Machine learning early-warning system for sector-level chronic childhood
stunting risk in Rwanda.
Author:  Thierry SHYAKA
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
from models import Intervention, SmsAlertLog, User, UserRole
from auth import create_access_token, get_current_user, hash_password, verify_password, require_roles
import chat

# -------------------------------------------------------------------------
# App initialization
# -------------------------------------------------------------------------
app = FastAPI(
    title="Kurinda API",
    description=(
        "Machine learning early-warning system for predicting sector-level "
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
def get_sectors(district: Optional[str] = None):
    """
    Return the sector risk GeoJSON for the dashboard map.

    Each feature carries: GID_3, sector/district/province names, risk_value
    (0-1), is_high_risk, source (dhs_measurement_2019_20 | model_prediction),
    confidence_band, and the top-3 SHAP risk drivers plus one protective
    factor. Geometry is WGS84 (EPSG:4326) for Leaflet.

    Optional `district` filters to just that district's sectors (used by the
    District Officer and CHW Supervisor dashboards, which are each scoped to
    the logged-in user's own district). Omit it for the full 422-sector map.
    """
    try:
        data = _load_sectors()
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="Sector data not available")

    if district is None or not district.strip():
        return data

    target = district.strip().lower()
    filtered = [
        f for f in data.get("features", [])
        if (f["properties"].get("NAME_2") or "").lower() == target
    ]
    return {"type": "FeatureCollection", "features": filtered}


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
# Geography lookups - the real district/sector names, derived from the same
# 422-sector GeoJSON the map uses. Registration validates against these
# instead of free text, so a typo can never silently break dashboard scoping.
# -------------------------------------------------------------------------
_geo_cache = None


def _geo_lookup():
    """
    Build (and cache) district -> sorted sector list, and sector -> district,
    both keyed by lowercase name for case-insensitive matching.
    """
    global _geo_cache
    if _geo_cache is not None:
        return _geo_cache

    data = _load_sectors()
    districts: dict[str, set[str]] = {}
    sector_to_district: dict[str, tuple[str, str]] = {}  # lower(sector) -> (sector, district)

    for f in data.get("features", []):
        props = f["properties"]
        district = props.get("NAME_2")
        sector = props.get("NAME_3")
        if not district or not sector:
            continue
        districts.setdefault(district, set()).add(sector)
        sector_to_district[sector.lower()] = (sector, district)

    district_lookup = {d.lower(): d for d in districts}
    districts_sorted = {d: sorted(s) for d, s in districts.items()}

    _geo_cache = {
        "districts_sorted": districts_sorted,
        "district_lookup": district_lookup,
        "sector_to_district": sector_to_district,
    }
    return _geo_cache


@app.get("/geo/districts")
def list_districts():
    """All 30 district names, sorted, for the registration form."""
    geo = _geo_lookup()
    return sorted(geo["districts_sorted"].keys())


@app.get("/geo/districts/{district}/sectors")
def list_sectors_for_district(district: str):
    """Sector names within one district, sorted, for a cascading dropdown."""
    geo = _geo_lookup()
    canonical = geo["district_lookup"].get(district.strip().lower())
    if canonical is None:
        raise HTTPException(status_code=404, detail="Unknown district")
    return geo["districts_sorted"][canonical]


# -------------------------------------------------------------------------
# Auth - role-based accounts (District Officer / CHW Supervisor / CHW).
# Self-signup: a user picks their role at registration, no admin step.
# Requires DATABASE_URL (users live in Postgres, not the in-memory GeoJSON).
#
# District Officers are scoped to a district; CHW Supervisors and CHWs pick
# their home sector, and the district is auto-derived from it, so a
# supervisor's dashboard can still show the full (meaningful) list of
# sectors in their district with their own sector pinned at the top.
# -------------------------------------------------------------------------
class RegisterRequest(SQLModel):
    name: str
    email: str
    password: str
    role: UserRole
    district: Optional[str] = None
    sector: Optional[str] = None


class LoginRequest(SQLModel):
    email: str
    password: str


class UserPublic(SQLModel):
    id: int
    name: str
    email: str
    role: UserRole
    district: Optional[str] = None
    sector: Optional[str] = None


class TokenResponse(SQLModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


def _require_db():
    if engine is None:
        raise HTTPException(status_code=503, detail="Database not configured")


def _resolve_jurisdiction(role: UserRole, district: Optional[str], sector: Optional[str]):
    """
    Validate + normalise district/sector for one role, against the real
    geography. Returns (district, sector) to store on the User.
    """
    geo = _geo_lookup()

    if role == UserRole.district_officer:
        if not district or not district.strip():
            raise HTTPException(status_code=400, detail="District is required for a District Officer account")
        canonical = geo["district_lookup"].get(district.strip().lower())
        if canonical is None:
            raise HTTPException(status_code=400, detail=f"Unknown district: {district!r}")
        return canonical, None

    # chw_supervisor and chw are both scoped to a home sector.
    if not sector or not sector.strip():
        raise HTTPException(status_code=400, detail="Sector is required for this account type")
    match = geo["sector_to_district"].get(sector.strip().lower())
    if match is None:
        raise HTTPException(status_code=400, detail=f"Unknown sector: {sector!r}")
    canonical_sector, canonical_district = match
    return canonical_district, canonical_sector


@app.post("/auth/register", response_model=TokenResponse)
def register(payload: RegisterRequest):
    """Create an account and return an access token, same as /auth/login."""
    _require_db()
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    district, sector = _resolve_jurisdiction(payload.role, payload.district, payload.sector)

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
            district=district,
            sector=sector,
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
# Interventions - District Officers log an intervention, CHW Supervisors
# mark a visit complete; same underlying record either way. Closes the
# loop from prediction -> alert -> action, which the dashboards otherwise
# stop short of.
# -------------------------------------------------------------------------
class InterventionCreate(SQLModel):
    sector: str
    note: Optional[str] = None


class InterventionPublic(SQLModel):
    id: int
    sector: str
    district: str
    note: Optional[str] = None
    logged_by_name: str
    logged_by_role: UserRole
    created_at: str


def _intervention_public(row: Intervention) -> InterventionPublic:
    return InterventionPublic(
        id=row.id,
        sector=row.sector,
        district=row.district,
        note=row.note,
        logged_by_name=row.logged_by_name,
        logged_by_role=row.logged_by_role,
        created_at=row.created_at.isoformat(),
    )


@app.post("/interventions", response_model=InterventionPublic)
def create_intervention(
    payload: InterventionCreate,
    user: User = Depends(require_roles("district_officer", "chw_supervisor")),
):
    """Log an intervention/visit for a sector. District Officer or CHW
    Supervisor only - the plain CHW role has no dashboard to call this from."""
    _require_db()
    geo = _geo_lookup()
    match = geo["sector_to_district"].get(payload.sector.strip().lower())
    if match is None:
        raise HTTPException(status_code=400, detail=f"Unknown sector: {payload.sector!r}")
    canonical_sector, canonical_district = match

    with Session(engine) as session:
        row = Intervention(
            sector=canonical_sector,
            district=canonical_district,
            note=(payload.note or "").strip() or None,
            logged_by_id=user.id,
            logged_by_name=user.name,
            logged_by_role=user.role,
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        return _intervention_public(row)


@app.get("/interventions", response_model=list[InterventionPublic])
def list_interventions(
    district: Optional[str] = None,
    sector: Optional[str] = None,
    _user: User = Depends(get_current_user),
):
    """List logged interventions, newest first. Filter by district and/or
    sector - the dashboards always pass their own district."""
    _require_db()
    with Session(engine) as session:
        query = select(Intervention).order_by(Intervention.created_at.desc())
        if district:
            query = query.where(Intervention.district == district)
        if sector:
            query = query.where(Intervention.sector == sector)
        rows = session.exec(query).all()
        return [_intervention_public(r) for r in rows]


# -------------------------------------------------------------------------
# Chatbot - CHW Supervisor only. Grounded in the supervisor's own district's
# real sector data and logged interventions, plus a small curated IYCF
# reference (see chat.py). Deliberately narrow: no general medical advice,
# no off-topic chat - enforced in the system prompt, not just by suggestion.
# -------------------------------------------------------------------------
class ChatMessage(SQLModel):
    role: str  # "user" | "model"
    text: str


class ChatRequest(SQLModel):
    message: str
    history: Optional[list[ChatMessage]] = None


class ChatResponse(SQLModel):
    reply: str


@app.post("/chat", response_model=ChatResponse)
def chat_endpoint(
    payload: ChatRequest,
    user: User = Depends(require_roles("district_officer", "chw_supervisor", "chw")),
):
    """Answer a user's question, grounded in their own district's real
    sector risk data and a curated nutrition-guidance reference. Available
    to all three roles; the assistant's framing of itself (but not its
    scope or guardrails) adapts to the caller's role - see chat.py."""
    if not chat.GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="Chatbot not configured (missing GEMINI_API_KEY)")
    if not user.district:
        raise HTTPException(status_code=400, detail="Account has no district on file")
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message is required")

    try:
        data = _load_sectors()
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="Sector data not available")

    target = user.district.strip().lower()
    sectors = [
        f["properties"]
        for f in data.get("features", [])
        if (f["properties"].get("NAME_2") or "").lower() == target
    ]

    interventions: list[dict] = []
    if engine is not None:
        with Session(engine) as session:
            rows = session.exec(
                select(Intervention)
                .where(Intervention.district == user.district)
                .order_by(Intervention.created_at.desc())
                .limit(20)
            ).all()
            interventions = [_intervention_public(r).model_dump() for r in rows]

    try:
        reply = chat.ask_gemini(
            district=user.district,
            role=user.role.value,
            sectors=sectors,
            interventions=interventions,
            message=payload.message,
            history=[h.model_dump() for h in (payload.history or [])],
        )
    except chat.GeminiQuotaExceeded as e:
        # Distinct from the generic case below: on the free tier this is a
        # hard daily cap, so "try again" would be misleading - tell the
        # supervisor plainly rather than implying a retry might help.
        print("Kurinda chat: quota exceeded:", e)
        raise HTTPException(
            status_code=429,
            detail="The assistant has reached its daily message limit. Please try again tomorrow.",
        )
    except Exception as e:
        # Never echo the raw exception to the client: the Gemini API key is
        # a URL query param, so exception text (from requests/urllib3, or
        # anything unexpected) could embed the full request URL including
        # it. Full detail goes to server logs only.
        print("Kurinda chat: request failed:", e)
        raise HTTPException(status_code=502, detail="Chatbot is temporarily unavailable, please try again")

    return ChatResponse(reply=reply)


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
    """Build the Kinyarwanda risk-alert message for one sector.

    "Umurenge" (sector), not "umudugudu" (village) - {sector_name} is a
    sector. "Kugwingira" (stunting) matches the term the chatbot already
    uses for this exact condition (see chat.py), rather than the more
    generic "kwangirika k'imirire" (malnutrition). Native-speaker review
    still recommended before wider rollout - this is a real message to a
    real phone."""
    return (
        f"MUTUZO: Umurenge wa {sector_name} uri mu kaga ko kugwingira "
        f"kw'abana mu mezi 3 ari imbere. Sura imiryango ifite abana bari "
        f"munsi y'imyaka 2. Subiza 1 wemeje."
    )


@app.post("/alerts/send")
def send_alerts(limit: int = 5, user: User = Depends(require_roles("chw"))):
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
def get_alerts_history(limit: int = 50, user: User = Depends(require_roles("chw"))):
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

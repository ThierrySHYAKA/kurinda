"""
Kurinda Backend API
Machine learning early-warning system for village-level chronic childhood
stunting risk in Rwanda.
"""
import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

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
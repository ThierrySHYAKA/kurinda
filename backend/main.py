"""
Kurinda Backend API
Machine learning early-warning system for village-level chronic childhood
stunting risk in Rwanda.

Project: BSc Software Engineering Capstone, African Leadership University
Author:  Thierry SHYAKA
Supervisor: Dirac MURAIRI
"""

from fastapi import FastAPI
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
# CORS — allows the Next.js frontend to call this API from a browser.
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
# Routes
# -------------------------------------------------------------------------
@app.get("/")
def root():
    """Landing endpoint — confirms the API is reachable."""
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
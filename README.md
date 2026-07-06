# Kurinda

> *Kurinda* (Kinyarwanda: *"to protect"*) — a machine learning early-warning
> system that predicts village-level chronic childhood stunting risk in Rwanda
> using multi-source data fusion.

[![Backend](https://img.shields.io/badge/backend-live-brightgreen)](https://kurinda-backend.onrender.com)
[![Frontend](https://img.shields.io/badge/frontend-live-brightgreen)](https://kurinda-frontend.onrender.com)
[![Status](https://img.shields.io/badge/status-functional-brightgreen)]()
[![License](https://img.shields.io/badge/license-academic-lightgrey)]()

## About

Around **510,000 Rwandan children under five are chronically undernourished**
(NISR, MoH & ICF, 2025), with stunting rates of 27%. Damage to brain and body
development is largely irreversible after age 2, yet existing nutrition
interventions are reactive — children are enrolled only after they are already
stunted. Kurinda flips this by forecasting stunting risk at the **sector**
level, giving Rwanda's community health workers a window to act before the
damage occurs.

The model fuses five data sources — household nutrition (DHS), agricultural
production (RAB / NISR), market food prices (WFP / eSoko), satellite climate
signals (CHIRPS rainfall, MODIS NDVI), and administrative geography (GADM /
NISR shapefiles) — into a longitudinal sector-month dataset and trains a
LightGBM gradient-boosted model with SHAP-based explanations. Predictions are
delivered through a Next.js web dashboard for district nutrition officers and
CHW supervisors, and SMS alerts (Africa's Talking) for rural CHWs using
feature phones.

## Live demo

| Service | URL |
|---|---|
| Frontend dashboard | https://kurinda-frontend.onrender.com/dashboard |
| CHW priority list | https://kurinda-frontend.onrender.com/chw |
| Backend API | https://kurinda-backend.onrender.com |
| Interactive API docs | https://kurinda-backend.onrender.com/docs |

> Free-tier services spin down after 15 minutes of inactivity; the first
> request may take up to a minute while the service wakes up.

**Demo video:** _<add your 5-minute walkthrough link here>_

## Features (implemented)

- **Sector risk map** — Leaflet map of all 422 Rwandan sectors, colour-coded by
  predicted stunting risk, served from the backend `/sectors` endpoint.
- **Drill-down** — click any sector for its risk %, data source, top-3 SHAP
  risk drivers, and protective factor.
- **CHW priority list** — all 422 sectors ranked by risk, filterable by
  district, for community health workers.
- **SMS alerts** — Kinyarwanda risk-alert SMS for the highest-risk sectors,
  sent via Africa's Talking (`POST /alerts/send`).
- **Explainable ML** — LightGBM classifier with SHAP explanations; every
  prediction carries its top contributing factors.

## Quick start (run locally)

### Prerequisites
- Python 3.11+
- Node.js 18+
- Git

### 1. Clone the repository
```bash
git clone https://github.com/ThierrySHYAKA/kurinda.git
cd kurinda
```

### 2. Run the backend (FastAPI)
```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS / Linux:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload
```
The API is now at http://localhost:8000 (docs at http://localhost:8000/docs).

**Optional — SMS alerts.** To enable `POST /alerts/send`, create `backend/.env`:
```
AT_USERNAME=sandbox
AT_API_KEY=your_africastalking_sandbox_key
AT_TEST_NUMBER=+250700000000
```
`.env` is git-ignored. In production these are set as environment variables on
the host. The API runs fine without them; only the SMS endpoint needs them.

### 3. Run the frontend (Next.js)
In a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:3000/dashboard.

By default the frontend calls the live backend
(`https://kurinda-backend.onrender.com`). To point it at your local backend,
create `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 4. (Optional) Reproduce the ML pipeline
The notebooks in `ml/notebooks/` build the dataset and train the model. They
require the raw data under `data/raw/` (not included — see *Data and ethics*).
Run them in order: `01_data_exploration` → `02_feature_engineering` →
`03_model_training`. The final notebook writes model artifacts and
`sectors_risk.geojson` to `data/processed/model/`.

## Repository structure

```
kurinda/
│
├── backend/                          FastAPI service (Python 3.11)
│   ├── main.py                       App entry point, routes, CORS, SMS
│   ├── requirements.txt              Pinned dependencies
│   └── data/
│       └── sectors_risk.geojson      422-sector risk GeoJSON (served to map)
│
├── frontend/                         Next.js 16 + TypeScript + Tailwind
│   ├── src/
│   │   └── app/                      Next.js App Router
│   │       ├── layout.tsx            Root layout
│   │       ├── page.tsx              Homepage with live backend status
│   │       ├── globals.css           Tailwind + Leaflet styles
│   │       ├── dashboard/
│   │       │   ├── page.tsx          Officer view: risk map + drill-down
│   │       │   └── MapView.tsx       Leaflet map component
│   │       └── chw/
│   │           └── page.tsx          CHW risk-ranked sector list
│   ├── package.json
│   └── tsconfig.json
│
├── ml/                               Machine learning pipeline
│   └── notebooks/
│       ├── 01_data_exploration.ipynb      DHS pipeline + EDA
│       ├── 02_feature_engineering.ipynb   Sector-month master dataset
│       ├── 03_model_training.ipynb        LightGBM + SHAP + LOPO + GeoJSON
│       └── figures/03_model_training/     Defense figures (ROC, SHAP, etc.)
│
├── data/                             Datasets (gitignored except processed model)
│   ├── raw/                          DHS, GADM, CHIRPS, NDVI, WFP (not committed)
│   └── processed/
│       └── model/                    Model, features, predictions, GeoJSON
│
├── docs/                             Approvals (supervisor, DHS, ethics)
├── .gitignore
└── README.md
```

## Tech stack

| Layer | Technology |
|---|---|
| **Backend** | FastAPI, Uvicorn, Python 3.11 |
| **Frontend** | Next.js 16 (App Router), TypeScript, Tailwind CSS, Leaflet |
| **ML** | LightGBM, scikit-learn, SHAP, pandas, GeoPandas |
| **Geo/Data** | Google Earth Engine (CHIRPS, MODIS NDVI), GADM, DHS, WFP |
| **SMS** | Africa's Talking |
| **Hosting** | Render (free tier) |

## Machine learning summary

The model is a sector-level binary classifier (high vs. low stunting risk,
WHO 30% threshold) trained on 320 DHS-measured sectors and used to predict 102
unmeasured sectors.

| Metric | Value |
|---|---|
| Test AUC-ROC | 0.6967 |
| Recall (high-risk caught) | 0.96 |
| Precision | 0.57 |
| Leave-one-province-out mean AUC | 0.578 |

These are honestly reported: the model is a rigorous, leakage-free baseline
with a genuine but modest signal. It over-flags at the default threshold (high
recall, lower precision) — appropriate for a screening tool where missing an
at-risk sector is the costly error — and cross-province generalisation is the
main limitation. Full analysis is in `ml/notebooks/03_model_training.ipynb`.

## API endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/` | Service info |
| GET | `/health` | Health check |
| GET | `/sectors` | Full 422-sector risk GeoJSON (for the map) |
| GET | `/sectors/summary` | Counts by risk class and data source |
| POST | `/alerts/send` | Send Kinyarwanda SMS alerts for high-risk sectors |

## Project context

BSc Software Engineering capstone project at African Leadership University,
Kigali.

- **Author**: Thierry SHYAKA — `t.shyaka1@alustudent.com`
- **Supervisor**: Dirac Murairi

## Data and ethics

All training data is **public, anonymized, and aggregated**. No personally
identifiable health information is downloaded, stored, or transmitted. DHS
microdata is accessed under registered research agreement (June 2026) and is
never redistributed via this repository or its services — only sector-level
aggregate rates and model predictions are published. Raw data (`data/raw/`) is
excluded from version control.

## License

Academic work; redistribution of derived datasets is not permitted. Source
code is shared for academic review.

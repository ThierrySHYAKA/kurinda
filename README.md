# Kurinda

> *Kurinda* (Kinyarwanda: *"to protect"*) — a machine learning early-warning
> system that predicts village-level chronic childhood stunting risk in Rwanda
> using multi-source data fusion.

[![Backend](https://img.shields.io/badge/backend-live-brightgreen)](https://kurinda-backend.onrender.com)
[![Frontend](https://img.shields.io/badge/frontend-live-brightgreen)](https://kurinda-frontend.onrender.com)
[![Status](https://img.shields.io/badge/status-in%20development-blue)]()
[![License](https://img.shields.io/badge/license-academic-lightgrey)]()

## About

Around **510,000 Rwandan children under five are chronically undernourished**
(NISR, MoH & ICF, 2025), with stunting rates of 27%. Damage to brain and body
development is largely irreversible after age 2, yet existing nutrition
interventions are reactive — children are enrolled only after they are already
stunted. Kurinda flips this by forecasting stunting risk **three to six months
ahead** at the **village** level, giving Rwanda's 45,000 community health
workers a window to act before the damage occurs.

The model fuses five data sources — household nutrition (DHS), agricultural
production (RAB / NISR), market food prices (WFP / eSoko), satellite climate
signals (CHIRPS rainfall, MODIS NDVI), and administrative geography (GADM /
NISR shapefiles) — into a longitudinal village-month dataset and trains a
LightGBM gradient-boosted model with SHAP-based explanations. Predictions are
delivered through three channels: a Next.js web dashboard for district
nutrition officers, a Kinyarwanda chatbot for CHW supervisors, and SMS alerts
for rural CHWs using feature phones.

## Live services

| Service | URL |
|---|---|
| Backend API | https://kurinda-backend.onrender.com |
| Frontend | https://kurinda-frontend.onrender.com |
| API docs | https://kurinda-backend.onrender.com/docs |

Free-tier services spin down after 15 minutes of inactivity; the first
request may take up to a minute while the service wakes up.

## Repository structure

The project follows a monorepo layout with three top-level workspaces
(`backend/`, `frontend/`, `ml/`) and supporting directories for data, docs,
and CI. Items marked *(planned)* are part of the system design and will be
added during the implementation phase.

```
kurinda/
│
├── backend/                          FastAPI service (Python 3.11)
│   ├── main.py                       App entry point, routes, CORS
│   ├── requirements.txt              Pinned Python dependencies
│   ├── app/                          (planned) Modular app package
│   │   ├── api/                      (planned) Route handlers per resource
│   │   │   ├── health.py             (planned) Health check endpoint
│   │   │   ├── villages.py           (planned) Village lookup & metadata
│   │   │   ├── predictions.py        (planned) /predict and /explain
│   │   │   ├── interventions.py      (planned) CHW intervention logging
│   │   │   ├── sms.py                (planned) Africa's Talking webhook
│   │   │   └── chat.py               (planned) Kinyarwanda chatbot bridge
│   │   ├── core/                     (planned) Settings, security, logging
│   │   ├── models/                   (planned) SQLAlchemy ORM models
│   │   ├── schemas/                  (planned) Pydantic request/response
│   │   └── services/                 (planned) Business logic layer
│   └── tests/                        (planned) Backend pytest suite
│
├── frontend/                         Next.js 16 + TypeScript + Tailwind
│   ├── src/
│   │   └── app/                      Next.js App Router
│   │       ├── layout.tsx            Root layout
│   │       ├── page.tsx              Homepage with live backend status
│   │       ├── globals.css           Tailwind base styles
│   │       ├── dashboard/            (planned) Officer view: risk heatmap
│   │       ├── villages/[id]/        (planned) Per-village drill-down
│   │       └── chat/                 (planned) Kinyarwanda chatbot UI
│   ├── public/                       Static assets
│   ├── package.json                  Frontend dependencies
│   ├── tsconfig.json                 TypeScript configuration
│   └── next.config.ts                Next.js configuration
│
├── ml/                               Machine learning pipeline
│   ├── notebooks/                    (planned) Jupyter exploration
│   │   ├── 01_dhs_exploration.ipynb  (planned) DHS schema + EDA
│   │   ├── 02_feature_engineering.ipynb  (planned) Village-month build
│   │   ├── 03_baseline_model.ipynb   (planned) LightGBM baseline
│   │   └── 04_model_evaluation.ipynb (planned) SHAP + metrics
│   ├── src/                          (planned) Production training code
│   │   ├── data/                     (planned) Loaders per source
│   │   │   ├── dhs_loader.py         (planned) DHS Stata .dta reader
│   │   │   ├── gadm_loader.py        (planned) Admin boundaries
│   │   │   ├── wfp_loader.py         (planned) Market prices
│   │   │   ├── chirps_loader.py      (planned) Rainfall via GEE
│   │   │   └── modis_loader.py       (planned) NDVI via GEE
│   │   ├── features/                 (planned) Engineering pipeline
│   │   ├── models/                   (planned) Train / tune / persist
│   │   └── explain/                  (planned) SHAP explanations
│   └── requirements.txt              (planned) ML dependencies
│
├── data/                             Raw + processed datasets (gitignored)
│   ├── raw/
│   │   ├── dhs/                      DHS microdata (registered access)
│   │   │   ├── 2014-15/              ✓ 4 files (HR, IR, KR, GE)
│   │   │   ├── 2019-20/              ✓ 4 files (HR, IR, KR, GE)
│   │   │   └── 2024-25/              (microdata not yet released)
│   │   ├── geo/                      ✓ GADM v4.1 Rwanda boundaries
│   │   ├── wfp/                      ✓ WFP food prices + markets
│   │   ├── chirps/                   (planned) Rainfall GeoTIFFs
│   │   ├── ndvi/                     (planned) MODIS NDVI rasters
│   │   └── rab/                      (planned) Agricultural production
│   └── processed/                    (planned) Village-month master dataset
│
├── docs/                             Design notes and diagrams
│   ├── approvals/                    Supervisor + DHS + ethics PDFs
│   ├── architecture/                 (planned) System architecture diagrams
│   └── data_sources.md               (planned) Per-source documentation
│
├── .github/                          (planned) CI/CD workflows
│   └── workflows/                    (planned) Backend + frontend tests
│
├── .gitignore                        Python, Node, data, IDE exclusions
└── README.md                         You are here
```

## Tech stack

| Layer | Technology |
|---|---|
| **Backend** | FastAPI, Uvicorn, Python 3.11 |
| **Frontend** | Next.js 16 (App Router), TypeScript, Tailwind CSS |
| **ML** | LightGBM, scikit-learn, SHAP, pandas, NumPy |
| **Geo** | GeoPandas, Google Earth Engine (CHIRPS, MODIS NDVI) |
| **Database** | PostgreSQL *(planned)* |
| **Delivery** | Africa's Talking SMS, Google Gemini chatbot *(planned)* |
| **Hosting** | Render (free tier) |
| **CI/CD** | GitHub Actions *(planned)* |

## Implementation timeline

Implementation runs over 9 weeks from May 21 to July 27, 2026:

| Week | Focus |
|---|---|
| 1 | Setup, data acquisition, deployed skeletons |
| 2 | Data pipeline & feature engineering |
| 3 | LightGBM baseline + `/predict` endpoint |
| 4 | Model tuning + SHAP explainability |
| 5 | Dashboard polish (officer + CHW views) |
| 6 | SMS alerts via Africa's Talking |
| 7 | Kinyarwanda chatbot (Gemini + RAG) |
| 8 | Integration testing & deployment |
| 9 | Final report, slides, defense |

## Project context

This is the BSc Software Engineering capstone project at African Leadership
University, Kigali.

- **Author**: Thierry SHYAKA — `t.shyaka1@alustudent.com`
- **Institution**: African Leadership University

## Data and ethics

All training data is **public, anonymized, and aggregated**. No personally
identifiable health information is downloaded, stored, or transmitted by this
project. DHS microdata is accessed under registered research agreement
(June 2026) and is never redistributed via this repository or its services.
Raw data files (`data/raw/`, `data/processed/`) are excluded from version
control.

## License

This is academic work; redistribution of derived datasets is not permitted.
Source code is shared for academic review. A formal license will be added at
project completion.

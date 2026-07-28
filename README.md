# Kurinda

> *Kurinda* (Kinyarwanda: *"to protect"*) — a machine learning early-warning
> system that predicts sector-level chronic childhood stunting risk in Rwanda
> using multi-source data fusion.

[![Backend](https://img.shields.io/badge/backend-live-brightgreen)](https://kurinda-backend-us.onrender.com)
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

The model fuses four public data sources — household nutrition ground truth
(DHS 2019–20), market food prices (WFP, via Humanitarian Data Exchange),
satellite climate signals (CHIRPS rainfall, MODIS NDVI, via Google Earth
Engine), and administrative geography (GADM / NISR shapefiles) — into a
longitudinal sector-month dataset and trains a LightGBM gradient-boosted
model with SHAP-based explanations. Agricultural production data (Rwanda
Agriculture Board) was scoped in the original proposal but did not make it
into the final trained feature set — the delivered model runs on climate and
market signals only. Predictions are delivered through a Next.js web
dashboard for district nutrition officers and CHW supervisors, a grounded
bilingual assistant, and SMS alerts (Africa's Talking) for rural CHWs using
feature phones.

## Live demo

| Service | URL |
|---|---|
| App (start here) | https://kurinda-frontend.onrender.com |
| Backend API | https://kurinda-backend-us.onrender.com |
| Interactive API docs | https://kurinda-backend-us.onrender.com/docs |

> Free-tier services spin down after 15 minutes of inactivity; the first
> request may take up to a minute while the service wakes up.
>
> The backend runs on Render's Oregon (US West) region rather than Frankfurt —
> the assistant's model provider (Google's Generative Language API) rejects
> requests from some regions with a 400 `FAILED_PRECONDITION` error, which
> only surfaced once the assistant was exercised end-to-end against the live
> deployment rather than tested locally. A second backend instance may still
> exist in Frankfurt from before this was diagnosed; the frontend is
> configured to talk to the Oregon one.

Each of the three dashboards (`/dashboard`, `/chw`, `/alerts`) is role-gated —
sign up from the home page picking District Officer, CHW Supervisor, or CHW,
and you're routed straight to that role's view. A signed-in user can never
land on a dashboard that isn't theirs.

**Demo video (5 min):** https://drive.google.com/file/d/1GlUPokstBm-fcm7g6uPRORvtB_VaXl3s/view?usp=sharing

## Features (implemented)

- **Role-based accounts** — self-signup as District Officer, CHW Supervisor,
  or CHW, with a real district/sector picked from the actual 422-sector list
  (not free text). Each role is routed to, and gated to, only its own view.
- **District-scoped risk map** — Leaflet map of the officer's own district,
  auto-zoomed to fit it, colour-coded by predicted stunting risk, served from
  the backend `/sectors?district=` endpoint.
- **Drill-down** — click any sector for its risk %, data source, top-3 SHAP
  risk drivers, and protective factor.
- **CHW Supervisor priority list** — every sector in the supervisor's
  district ranked by risk, their own home sector pinned first; renders as
  cards on mobile and a table on desktop.
- **Intervention tracking** — District Officers log interventions with a
  note; CHW Supervisors mark visits complete with one tap. Both write to the
  same shared record, so an officer and a supervisor for the same district
  see each other's activity.
- **SMS alerts** — Kinyarwanda risk-alert SMS for the highest-risk sectors,
  sent via Africa's Talking (`POST /alerts/send`), with a pre-dispatch preview
  showing exactly which sectors will be messaged.
- **Explainable ML** — LightGBM classifier with SHAP explanations; every
  prediction carries its top contributing factors, and every sector is
  labelled with its data source (`dhs_measurement_2019_20` or
  `model_prediction`) so a predicted sector is never shown with the visual
  authority of a measured one.
- **Grounded bilingual assistant** — a floating chat widget on all three
  role-gated views, backed by Google's Gemini API and grounded in the
  caller's own district's real sector data. Scoped strictly to that data plus
  general infant/child feeding guidance — it refuses medical diagnosis or
  prescription and redirects to a health facility. A static, hardcoded FAQ
  (`frontend/src/lib/helpFaq.ts`) answers common "how do I..." questions
  instantly, client-side, before ever spending a request against the
  assistant's daily quota.
- **Privacy Policy & Terms of Use** — a dedicated, public page (`/privacy`)
  describing what data is collected, which third parties (Gemini, Africa's
  Talking, Neon, Render) process it, security measures, and user rights,
  linked from the homepage footer and the registration screen.
- **Light/dark theme** — defaults to light regardless of device/OS
  preference (for projector legibility during the capstone defence), with a
  persisted user toggle.

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

**Optional — database.** To persist SMS alert history (`GET /alerts/history`),
add a Postgres connection string (e.g. from [Neon](https://neon.com)) to
`backend/.env`:
```
DATABASE_URL=postgresql://<user>:<password>@<host>/<db>?sslmode=require
```
Tables are created automatically on startup. Without this variable the API
still runs; `/alerts/send` just skips logging and `/alerts/history` returns
503.

**Optional — accounts.** To enable `/auth/register`, `/auth/login`, and
`/auth/me` (role-based accounts for District Officer / CHW Supervisor / CHW),
add a signing secret to `backend/.env`, alongside `DATABASE_URL` above:
```
JWT_SECRET_KEY=<a long random string, e.g. `python -c "import secrets; print(secrets.token_hex(32))"`>
```
Users self-register and pick their role at signup. Without `DATABASE_URL` and
`JWT_SECRET_KEY` set, the auth endpoints return 503.

### 3. Run the frontend (Next.js)
In a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:3000 and click **Get started** — pick an account type
(District Officer / CHW Supervisor / CHW), a real district/sector, and you're
routed straight to that role's dashboard. Each dashboard requires the
matching role's account; there's no way to view another role's view.

By default the frontend calls the live backend
(`https://kurinda-backend-us.onrender.com`). To point it at your local backend,
create `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```
Running fully locally requires the backend's `DATABASE_URL` and
`JWT_SECRET_KEY` to be set (step 2 above) — accounts, login, and
interventions all need the database.

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
│   ├── main.py                       Routes: sectors, geo, auth, interventions, chat, alerts
│   ├── db.py                         Postgres (Neon) engine/session + migrations
│   ├── models.py                     SQLModel tables: User, Intervention, SmsAlertLog
│   ├── auth.py                       Password hashing, JWT issue/verify, role guard
│   ├── chat.py                       Gemini-backed assistant, grounded per-district, all 3 roles
│   ├── requirements.txt              Pinned dependencies
│   └── data/
│       └── sectors_risk.geojson      422-sector risk GeoJSON (served to map)
│
├── frontend/                         Next.js 16 + TypeScript + Tailwind
│   ├── src/
│   │   ├── lib/
│   │   │   ├── auth.ts               Auth client (register/login/logout, authFetch)
│   │   │   ├── interventions.ts      Intervention/visit logging client
│   │   │   ├── chat.ts               Assistant client (POST /chat)
│   │   │   ├── helpFaq.ts            Static client-side FAQ, checked before calling the assistant
│   │   │   └── useRequireRole.ts     Route guard hook (role-gates each dashboard)
│   │   ├── components/
│   │   │   ├── AppHeader.tsx         Shared header for the 3 role-gated pages
│   │   │   ├── ChatWidget.tsx        Floating assistant widget (all 3 role-gated views)
│   │   │   ├── StatTile.tsx          Shared stat tile (home page, dashboard)
│   │   │   └── Spinner.tsx           Shared loading spinner
│   │   └── app/                      Next.js App Router
│   │       ├── layout.tsx            Root layout
│   │       ├── page.tsx              Homepage: live stats, get-started flow
│   │       ├── globals.css           Tailwind + Leaflet styles
│   │       ├── login/                Log in, redirects by role
│   │       ├── register/             Self-signup: role -> details -> district/sector
│   │       ├── dashboard/            Officer view: district risk map + drill-down + interventions
│   │       │   └── MapView.tsx       Leaflet map component
│   │       ├── chw/                  Supervisor view: district priority list + mark-visit
│   │       ├── alerts/               CHW SMS alerts page
│   │       └── privacy/              Privacy Policy & Terms of Use (public page)
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
├── docs/                             Related project files (see below)
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
| **Assistant** | Google Gemini API (`gemini-flash-latest`) |
| **SMS** | Africa's Talking |
| **Database** | Postgres (Neon), SQLModel |
| **Auth** | JWT (PyJWT), bcrypt |
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

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | none | Service info |
| GET | `/health` | none | Health check |
| GET | `/sectors` | none | Sector risk GeoJSON; optional `?district=` to scope to one district |
| GET | `/sectors/summary` | none | Counts by risk class and data source |
| GET | `/geo/districts` | none | All 30 district names, for the registration form |
| GET | `/geo/districts/{district}/sectors` | none | Sector names within one district |
| POST | `/auth/register` | none | Self-signup with a role and a real district/sector |
| POST | `/auth/login` | none | Log in with email + password, returns a JWT |
| GET | `/auth/me` | any role | Current account for the bearer token |
| POST | `/interventions` | officer, supervisor | Log an intervention/visit for a sector |
| GET | `/interventions` | officer, supervisor | List logged interventions, filterable by `district`/`sector` |
| POST | `/chat` | officer, supervisor, chw | Ask the grounded assistant a question about your own district's data |
| POST | `/alerts/send` | chw | Send Kinyarwanda SMS alerts for high-risk sectors |
| GET | `/alerts/history` | chw | Most recent SMS alerts sent, newest first (requires `DATABASE_URL`) |

Full interactive documentation (request/response schemas, try-it-out) is at
[`/docs`](https://kurinda-backend-us.onrender.com/docs).

## Related project files

Supervisor-approved proposal, ethics clearance, and the final capstone report
are in [`docs/`](docs):

- `Thierry SHYAKA_Proposal_mission Capstone.docx.pdf` — approved capstone proposal
- `Thierry SHYAKA May 26 Research Ethics Application Checklist.pdf` — ethics research application
- `ALU_ REC Approved Ethic Clearance Letter -  M26.pdf` — REC approval letter (Ref. M26-BSE-068)
- `Thierry SHYAKA_Capstone [Kurinda] - Report.docx` / `.docx.pdf` — final capstone report

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

Account-level data practices (what's collected, which third parties process
it, and user rights under Rwanda's Law N° 058/2021) are documented in full on
the live [Privacy Policy & Terms of Use](https://kurinda-frontend.onrender.com/privacy)
page.

## License

Academic work; redistribution of derived datasets is not permitted. Source
code is shared for academic review.

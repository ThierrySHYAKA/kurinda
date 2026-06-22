"""
Kurinda — MODIS NDVI extraction (sector level, monthly)

Pulls monthly mean NDVI (Normalized Difference Vegetation Index) from
MODIS Terra Vegetation Indices 16-Day L3 Global 250 m (MOD13Q1.061)
for Rwanda 2020-01 to 2025-12, aggregated to Rwanda's 422 sectors
(GADM admin level 3).

Why NDVI matters for Kurinda: vegetation health proxies food security
risk. Persistent low NDVI in a sector signals failing crops and pasture,
which is a leading indicator of household food stress and subsequent
childhood nutrition outcomes. Combined with CHIRPS rainfall, NDVI lets
the model distinguish between "rain came but crops still failed"
(e.g. pests, disease, soil) and "no rain, no crops" scenarios.

Aggregation level: sectors, same as CHIRPS, for consistent multi-source
fusion geography. MODIS resolution (250 m) is finer than a Rwandan
village (~2 km²), so we could go to village level, but the rest of
the dataset is sector level or coarser; pairing village NDVI with
sector rainfall would create spurious "precision" without justification.

Quality filtering: the SummaryQA band marks each pixel as
  0 = good data
  1 = marginal data
  2 = snow/ice
  3 = cloudy
We mask out QA > 1 (snow/cloud) so weather doesn't depress the
vegetation signal artificially. Marginal pixels are kept because
removing them creates too many gaps in fine-grained mountainous terrain.

NDVI scaling: MODIS stores NDVI as int16 multiplied by 10,000. We
divide by 10,000 to recover the conventional 0..1 scale (negative
values mean water/bare soil/cloud, near 1 means dense vegetation).

Resilience:
  - Per-month checkpoint to CSV (resumes if interrupted)
  - Exponential backoff retry on EE timeout errors
  - tileScale=4 to split heavy reductions across smaller tiles

Output: data/raw/ndvi/ndvi_sector_monthly.csv
        ~30,384 rows (422 sectors x 72 months)
        Columns: GID_3, NAME_3, NAME_2, NAME_1, year, month, ndvi
"""

from pathlib import Path
from datetime import datetime
import json
import time

import ee
import geopandas as gpd
import pandas as pd

# ----------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------
PROJECT_ID  = "kurinda-capstone"
GADM_PATH   = Path("data/raw/geo/gadm41_RWA.gpkg")
OUTPUT_PATH = Path("data/raw/ndvi/ndvi_sector_monthly.csv")
START_YEAR  = 2020
END_YEAR    = 2025

# Smoke test toggle:
#   LIMIT_MONTHS = 1    -> only process Jan 2020 (~30 sec, validates pipeline)
#   LIMIT_MONTHS = None -> process all 72 months (~15-20 min, real run)
LIMIT_MONTHS = None

# Retry config for transient EE timeouts
MAX_RETRIES     = 4    # initial attempt + 3 retries
RETRY_BASE_WAIT = 30   # seconds (then doubles each retry: 30, 60, 120)


def mask_clouds_and_snow(image: ee.Image) -> ee.Image:
    """
    Mask out MODIS pixels flagged as snow/ice or cloudy.

    The SummaryQA band uses these codes:
      0 = good data
      1 = marginal data
      2 = snow/ice
      3 = cloudy

    Keeping 0 and 1, masking 2 and 3.
    """
    qa = image.select("SummaryQA")
    mask = qa.lte(1)  # keep QA 0 and 1, drop 2 and 3
    return image.updateMask(mask)


def query_with_retry(reduced: ee.FeatureCollection, log, label: str) -> dict:
    """
    Call reduced.getInfo() with exponential backoff retry on EE timeouts.

    EE's per-request compute budget is server-side and varies with load.
    Transient timeouts on heavy MODIS reductions are common; a 30-60s
    wait usually clears them.
    """
    for attempt in range(MAX_RETRIES):
        try:
            return reduced.getInfo()
        except ee.ee_exception.EEException as e:
            msg = str(e).lower()
            transient = ("timed out" in msg
                         or "computation timed out" in msg
                         or "internal error" in msg)
            last_attempt = attempt == MAX_RETRIES - 1
            if transient and not last_attempt:
                wait = RETRY_BASE_WAIT * (2 ** attempt)
                log(f"           TIMEOUT on {label}, "
                    f"retry {attempt + 1}/{MAX_RETRIES - 1} in {wait}s...")
                time.sleep(wait)
                continue
            raise
    raise RuntimeError("unreachable")


def main() -> None:
    t0 = datetime.now()
    log = lambda msg: print(f"[{datetime.now():%H:%M:%S}] {msg}", flush=True)

    # ------------------------------------------------------------------
    # 1. Initialize Earth Engine
    # ------------------------------------------------------------------
    log("Initializing Earth Engine...")
    ee.Initialize(project=PROJECT_ID)
    log("OK Earth Engine ready")

    # ------------------------------------------------------------------
    # 2. Load Rwanda sectors and simplify (same as CHIRPS)
    # ------------------------------------------------------------------
    log(f"Loading sectors from {GADM_PATH}...")
    sectors_gdf = gpd.read_file(GADM_PATH, layer="ADM_ADM_3")
    log(f"OK Loaded {len(sectors_gdf)} sectors")

    sectors_subset = sectors_gdf[["GID_3", "NAME_3", "NAME_2", "NAME_1", "geometry"]].copy()
    sectors_subset["geometry"] = sectors_subset.geometry.simplify(
        tolerance=0.001, preserve_topology=True
    )
    log("OK Geometry simplified to 0.001 deg tolerance")

    # ------------------------------------------------------------------
    # 3. Convert to ee.FeatureCollection
    # ------------------------------------------------------------------
    log("Building ee.FeatureCollection from GeoJSON...")
    geojson = json.loads(sectors_subset.to_json())
    sectors_fc = ee.FeatureCollection(geojson)
    log("OK FeatureCollection built")

    # ------------------------------------------------------------------
    # 4. Reference MODIS collection
    # ------------------------------------------------------------------
    modis = ee.ImageCollection("MODIS/061/MOD13Q1")
    log("OK MODIS MOD13Q1 collection referenced")

    # ------------------------------------------------------------------
    # 5. Plan the months
    # ------------------------------------------------------------------
    all_months = [(y, m) for y in range(START_YEAR, END_YEAR + 1)
                          for m in range(1, 13)]
    if LIMIT_MONTHS is not None:
        all_months = all_months[:LIMIT_MONTHS]

    # ------------------------------------------------------------------
    # 6. Resume from existing checkpoint, if any
    # ------------------------------------------------------------------
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    results: list[dict] = []
    done: set[tuple[int, int]] = set()

    if OUTPUT_PATH.exists():
        existing = pd.read_csv(OUTPUT_PATH)
        results = existing.to_dict("records")
        done = set(zip(existing["year"], existing["month"]))
        log(f"OK Resuming from existing checkpoint: "
            f"{len(results):,} rows, {len(done)} months already complete")
    else:
        log("OK No existing checkpoint -- starting fresh")

    remaining = len(all_months) - len(done)
    log(f"Will process {len(all_months)} month(s) total; "
        f"{remaining} remaining")

    # ------------------------------------------------------------------
    # 7. Monthly loop with retry + per-month checkpoint
    # ------------------------------------------------------------------
    for i, (year, month) in enumerate(all_months, 1):
        if (year, month) in done:
            continue  # already in checkpoint, skip silently

        start = f"{year}-{month:02d}-01"
        end = (f"{year + 1}-01-01" if month == 12
               else f"{year}-{month + 1:02d}-01")

        log(f"[{i:>2}/{len(all_months)}] {year}-{month:02d}  querying EE...")

        # Per-month workflow:
        #   1. Filter the 16-day composites that touch this month
        #   2. Mask cloudy/snow pixels (SummaryQA > 1)
        #   3. Mean across composites
        #   4. Rescale int16 NDVI -> 0..1 by multiplying by 0.0001
        monthly = (modis
                   .filterDate(start, end)
                   .map(mask_clouds_and_snow)
                   .select("NDVI")
                   .mean()
                   .multiply(0.0001))

        reduced = monthly.reduceRegions(
            collection=sectors_fc,
            reducer=ee.Reducer.mean(),
            scale=250,       # MODIS native pixel size in meters
            tileScale=4,     # split into smaller tiles to reduce timeouts
        )

        data = query_with_retry(reduced, log, label=f"{year}-{month:02d}")

        for feature in data["features"]:
            props = feature["properties"]
            results.append({
                "GID_3":  props["GID_3"],
                "NAME_3": props["NAME_3"],
                "NAME_2": props["NAME_2"],
                "NAME_1": props["NAME_1"],
                "year":   year,
                "month":  month,
                "ndvi":   props.get("mean"),
            })
        log(f"           OK {len(data['features'])} sectors returned")

        # Per-month checkpoint -- if we crash next, we resume from here
        pd.DataFrame(results).to_csv(OUTPUT_PATH, index=False)

    # ------------------------------------------------------------------
    # 8. Final summary
    # ------------------------------------------------------------------
    df = pd.DataFrame(results)

    elapsed = (datetime.now() - t0).total_seconds()
    print()
    print("=" * 70)
    print(f"Done in {elapsed:.0f} seconds")
    print(f"Saved {len(df)} rows to {OUTPUT_PATH}")
    print(f"Sectors covered: {df['GID_3'].nunique()}")
    print(f"Months covered:  {df.groupby(['year', 'month']).ngroups}")
    print()
    print("Sample rows:")
    print(df.head())
    print()
    print("NDVI distribution across sector-months (0..1 scale):")
    print(df["ndvi"].describe())


if __name__ == "__main__":
    main()
"""
Kurinda — CHIRPS rainfall extraction (sector level, monthly)

Pulls monthly precipitation totals (mm) from CHIRPS daily rainfall
(UCSB-CHG/CHIRPS/DAILY) for Rwanda 2020-01 to 2025-12, aggregated
to Rwanda's 422 sectors (GADM admin level 3).

CHIRPS native resolution is 5 km, which closely matches a sector's
typical area (~60 km²), giving ~25 pixels per sector. This avoids
the resolution mismatch we would hit at the village level (~2 km²).
Village-level features inherit their parent sector's rainfall later
in the feature engineering step.

Output: data/raw/chirps/chirps_sector_monthly.csv
        ~30,384 rows (422 sectors × 72 months)
        Columns: GID_3, NAME_3, NAME_2, NAME_1, year, month, rainfall_mm
"""

from pathlib import Path
from datetime import datetime
import json

import ee
import geopandas as gpd
import pandas as pd

# ----------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------
PROJECT_ID  = "kurinda-capstone"
GADM_PATH   = Path("data/raw/geo/gadm41_RWA.gpkg")
OUTPUT_PATH = Path("data/raw/chirps/chirps_sector_monthly.csv")
START_YEAR  = 2020
END_YEAR    = 2025

# Smoke test toggle:
#   LIMIT_MONTHS = 1    -> only process Jan 2020 (~30 sec, validates pipeline)
#   LIMIT_MONTHS = None -> process all 72 months (~10-15 min, real run)
LIMIT_MONTHS = None


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
    # 2. Load Rwanda sectors (GADM admin level 3)
    # ------------------------------------------------------------------
    log(f"Loading sectors from {GADM_PATH}...")
    sectors_gdf = gpd.read_file(GADM_PATH, layer="ADM_ADM_3")
    log(f"OK Loaded {len(sectors_gdf)} sectors")

    # Trim columns and simplify geometry to ~111 m vertex tolerance.
    # CHIRPS pixels are 5 km wide, so simplifying to 0.001° loses no
    # meaningful precision. This drops the EE request payload from
    # ~26 MB (over the 10 MB API limit) to ~1.1 MB.
    sectors_subset = sectors_gdf[["GID_3", "NAME_3", "NAME_2", "NAME_1", "geometry"]].copy()
    sectors_subset["geometry"] = sectors_subset.geometry.simplify(
        tolerance=0.001, preserve_topology=True
    )
    log(f"OK Geometry simplified to 0.001 deg tolerance")

    # ------------------------------------------------------------------
    # 3. Convert to an ee.FeatureCollection via GeoJSON
    # ------------------------------------------------------------------
    log("Building ee.FeatureCollection from GeoJSON...")
    geojson = json.loads(sectors_subset.to_json())
    sectors_fc = ee.FeatureCollection(geojson)
    log("OK FeatureCollection built")

    # ------------------------------------------------------------------
    # 4. Reference the CHIRPS daily collection
    # ------------------------------------------------------------------
    chirps = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
    log("OK CHIRPS daily collection referenced")

    # ------------------------------------------------------------------
    # 5. Build the list of months to process
    # ------------------------------------------------------------------
    all_months = [(y, m) for y in range(START_YEAR, END_YEAR + 1)
                          for m in range(1, 13)]
    if LIMIT_MONTHS is not None:
        all_months = all_months[:LIMIT_MONTHS]
    log(f"Will process {len(all_months)} month(s): "
        f"{all_months[0]} ... {all_months[-1]}")

    # ------------------------------------------------------------------
    # 6. Loop monthly: sum daily rainfall, reduce to per-sector mean
    # ------------------------------------------------------------------
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    results = []

    for i, (year, month) in enumerate(all_months, 1):
        # CHIRPS filterDate is start-inclusive, end-exclusive
        start = f"{year}-{month:02d}-01"
        end = (f"{year + 1}-01-01" if month == 12
               else f"{year}-{month + 1:02d}-01")

        log(f"[{i:>2}/{len(all_months)}] {year}-{month:02d}  querying EE...")

        monthly = (chirps
                   .filterDate(start, end)
                   .select("precipitation")
                   .sum())

        # reduceRegions returns a FeatureCollection where each feature
        # carries the original sector props + a "mean" property = the
        # mean of the monthly total across CHIRPS pixels in the sector
        reduced = monthly.reduceRegions(
            collection=sectors_fc,
            reducer=ee.Reducer.mean(),
            scale=5000,  # CHIRPS native pixel size in meters
        )

        data = reduced.getInfo()
        for feature in data["features"]:
            props = feature["properties"]
            results.append({
                "GID_3":       props["GID_3"],
                "NAME_3":      props["NAME_3"],
                "NAME_2":      props["NAME_2"],
                "NAME_1":      props["NAME_1"],
                "year":        year,
                "month":       month,
                "rainfall_mm": props.get("mean"),
            })
        log(f"           OK {len(data['features'])} sectors returned")

        # Checkpoint every 12 months in case the run is interrupted
        if i % 12 == 0 or i == len(all_months):
            pd.DataFrame(results).to_csv(OUTPUT_PATH, index=False)
            log(f"           CHECKPOINT: {len(results)} rows -> {OUTPUT_PATH}")

    # ------------------------------------------------------------------
    # 7. Final save + summary
    # ------------------------------------------------------------------
    df = pd.DataFrame(results)
    df.to_csv(OUTPUT_PATH, index=False)

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
    print("Rainfall (mm/month) distribution across sector-months:")
    print(df["rainfall_mm"].describe())


if __name__ == "__main__":
    main()
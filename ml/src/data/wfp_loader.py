"""
Kurinda — WFP food prices loader (district level, monthly)

Cleans and aggregates the WFP Rwanda food prices dataset
(wfp_food_prices_rwa.csv, sourced from Humanitarian Data Exchange,
WFP Vulnerability Analysis & Mapping unit) into a tidy district-month-
commodity table for use in the village-month feature dataset.

Coverage caveat: WFP does not survey every Rwandan district every month.
After filtering to retail prices in kilograms for our target staples,
only ~7 of Rwanda's 30 districts have direct price data in the
2020-2025 window. The remaining districts will be handled in the
feature engineering step via a cascade fallback (district -> province
mean -> national mean).

Filters applied:
  - Date range: 2020-01-01 to 2025-12-31 (matches CHIRPS / model window)
  - pricetype:  Retail only (consumer-facing prices)
  - unit:       KG only (so prices stay directly comparable)
  - commodity:  Limited to staples relevant to childhood nutrition

Aggregation:
  For each (admin1, admin2, year, month, commodity) group, computes the
  mean retail price (RWF and USD) across all markets that reported in
  that district-month, plus market and observation counts for quality
  weighting later.

Output: data/processed/wfp_district_monthly.csv
        ~2,200 rows
        Columns: admin1, admin2, year, month, commodity,
                 price_rwf, price_usd, n_markets, n_observations
"""

from pathlib import Path
from datetime import datetime
import pandas as pd

# ----------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------
INPUT_PATH  = Path("data/raw/wfp/wfp_food_prices_rwa.csv")
OUTPUT_PATH = Path("data/raw/wfp/wfp_district_monthly.csv")

START_DATE = "2020-01-01"
END_DATE   = "2025-12-31"

# Staple commodities relevant to childhood nutrition in Rwanda.
# Names must match the WFP commodity column exactly (case-sensitive).
TARGET_COMMODITIES = [
    "Maize",
    "Maize flour",
    "Beans (dry)",
    "Cassava flour",
    "Potatoes (Irish)",
    "Sweet potatoes",   # may not survive KG filter; kept for completeness
    "Rice",             # likewise
    "Sorghum",
]


def main() -> None:
    log = lambda msg: print(f"[{datetime.now():%H:%M:%S}] {msg}", flush=True)

    # ------------------------------------------------------------------
    # 1. Load
    # ------------------------------------------------------------------
    log(f"Loading {INPUT_PATH}...")
    df = pd.read_csv(INPUT_PATH, parse_dates=["date"], low_memory=False)
    log(f"OK Loaded {len(df):,} rows")
    log(f"   Full date range in source: "
        f"{df['date'].min().date()} to {df['date'].max().date()}")

    # ------------------------------------------------------------------
    # 2. Filter step by step (log every step so dropped rows are auditable)
    # ------------------------------------------------------------------
    log("Filtering...")

    n_before = len(df)
    df = df[(df["date"] >= START_DATE) & (df["date"] <= END_DATE)]
    log(f"   Date in [{START_DATE}, {END_DATE}]: {n_before:>7,} -> {len(df):>6,}")

    n_before = len(df)
    df = df[df["pricetype"] == "Retail"]
    log(f"   pricetype == Retail:                 {n_before:>7,} -> {len(df):>6,}")

    n_before = len(df)
    df = df[df["unit"] == "KG"]
    log(f"   unit == KG:                          {n_before:>7,} -> {len(df):>6,}")

    n_before = len(df)
    df = df[df["commodity"].isin(TARGET_COMMODITIES)]
    log(f"   commodity in target staples:         {n_before:>7,} -> {len(df):>6,}")

    if df.empty:
        raise RuntimeError(
            "No rows survived filtering. Check the TARGET_COMMODITIES list "
            "against the actual unique values in the source file."
        )

    log("")
    log("Surviving commodity counts:")
    for c, n in df["commodity"].value_counts().items():
        log(f"   {c:<22s} {n:>6,}")

    # ------------------------------------------------------------------
    # 3. Extract year and month for the aggregation grain
    # ------------------------------------------------------------------
    df["year"]  = df["date"].dt.year
    df["month"] = df["date"].dt.month

    # ------------------------------------------------------------------
    # 4. Aggregate: mean price per (district, month, commodity)
    # ------------------------------------------------------------------
    log("")
    log("Aggregating to (admin1, admin2, year, month, commodity) grain...")

    grouped = (df.groupby(["admin1", "admin2", "year", "month", "commodity"])
                 .agg(price_rwf      = ("price",    "mean"),
                      price_usd      = ("usdprice", "mean"),
                      n_markets      = ("market",   "nunique"),
                      n_observations = ("market",   "size"))
                 .reset_index())

    log(f"OK Produced {len(grouped):,} aggregated rows")

    # ------------------------------------------------------------------
    # 5. Save
    # ------------------------------------------------------------------
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    grouped.to_csv(OUTPUT_PATH, index=False)
    log(f"OK Saved to {OUTPUT_PATH}")

    # ------------------------------------------------------------------
    # 6. Summary
    # ------------------------------------------------------------------
    print()
    print("=" * 70)
    print(f"Districts with data:  {grouped['admin2'].nunique():>3}  (of 30 in Rwanda)")
    print(f"Months covered:       {grouped.groupby(['year', 'month']).ngroups:>3}")
    print(f"Commodities covered:  {grouped['commodity'].nunique():>3}")
    print()
    print("Districts represented:")
    for d in sorted(grouped["admin2"].unique()):
        prov = grouped[grouped["admin2"] == d]["admin1"].iloc[0]
        n_rows = (grouped["admin2"] == d).sum()
        print(f"   {d:<20s} ({prov:<18s}) {n_rows:>4} rows")
    print()
    print("Sample rows:")
    print(grouped.head(6).to_string(index=False))
    print()
    print("Price stats per commodity (RWF / kg):")
    print(grouped.groupby("commodity")["price_rwf"]
                 .describe()[["count", "mean", "min", "max"]]
                 .round(0))


if __name__ == "__main__":
    main()
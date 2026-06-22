"""
Kurinda — GADM inspection (pyogrio backend)
Lists admin levels available in the downloaded GADM Rwanda file.
This decides at which level we aggregate CHIRPS and MODIS NDVI.
"""

from pathlib import Path
import geopandas as gpd
import pyogrio

GADM_PATH = Path("data/raw/geo/gadm41_RWA.gpkg")

print(f"File: {GADM_PATH}")
print(f"Exists: {GADM_PATH.exists()}")
print(f"Size: {GADM_PATH.stat().st_size / 1e6:.1f} MB\n")

layers_info = pyogrio.list_layers(GADM_PATH)
layer_names = [row[0] for row in layers_info]
print(f"Layers found: {len(layer_names)}\n")
print("=" * 70)

for layer in layer_names:
    gdf = gpd.read_file(GADM_PATH, layer=layer)
    print(f"\nLayer: {layer}")
    print(f"  Features: {len(gdf)}")
    print(f"  CRS:      {gdf.crs}")
    name_cols = [c for c in gdf.columns if c.startswith("NAME_")]
    if name_cols and len(gdf) > 0:
        sample = gdf[name_cols].head(2).to_dict("records")
        print(f"  Sample:   {sample}")
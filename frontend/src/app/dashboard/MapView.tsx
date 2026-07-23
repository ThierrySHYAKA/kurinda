"use client";

/**
 * Kurinda - Sector Risk Map (client component)
 *
 * Fetches the 422-sector risk GeoJSON from the backend /sectors endpoint
 * and renders it on a Leaflet map, colouring each sector by its predicted
 * chronic-stunting risk. Hovering a sector shows a quick tooltip; clicking a
 * sector reports its full properties to the parent (via onSelect) for the
 * drill-down panel.
 *
 * This is a client component ("use client") because Leaflet needs the
 * browser `window` object; it is loaded with SSR disabled from page.tsx.
 */
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import type { LatLngBoundsExpression, Layer, LeafletMouseEvent } from "leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import Spinner from "@/components/Spinner";
import { riskTier, TIER_LABEL } from "@/components/RiskBadge";
import "leaflet/dist/leaflet.css";

// Same convention page.tsx uses: env var in production, sensible fallback.
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://kurinda-backend.onrender.com";

// Properties carried by each sector feature (from the notebook geojson build).
export interface SectorProps {
  GID_3: string;
  NAME_3: string; // sector
  NAME_2: string; // district
  province_en: string; // province (English)
  risk_value: number; // 0-1
  is_high_risk: number; // 1 | 0
  source: string; // dhs_measurement_2019_20 | model_prediction
  risk_driver_1: string | null;
  risk_driver_2: string | null;
  risk_driver_3: string | null;
  protective_factor: string | null;
}

// Colour ramp for risk. Sequential, colour-blind-safe yellow->red, with a
// distinct grey for missing values so gaps are never mistaken for low risk.
function riskColor(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "#3f3f46"; // neutral-700
  if (v >= 0.5) return "#7f1d1d"; // red-900
  if (v >= 0.4) return "#b91c1c"; // red-700
  if (v >= 0.3) return "#ea580c"; // orange-600
  if (v >= 0.2) return "#f59e0b"; // amber-500
  return "#fde047"; // yellow-300
}

function sourceLabel(s: string): string {
  if (s === "dhs_measurement_2019_20") return "DHS measurement (2019-20)";
  if (s === "model_prediction") return "Model prediction";
  return s;
}

// Bounding box [[minLat, minLng], [maxLat, maxLng]] of every coordinate in a
// GeoJSON FeatureCollection, computed with plain arithmetic (no Leaflet
// helpers) so it can be handed to MapContainer's `bounds` prop and fitted
// synchronously at map creation - more reliable than fitting via an
// imperative call after the fact, which depends on Leaflet's map instance
// already having its final pixel size measured.
function computeBounds(fc: FeatureCollection): LatLngBoundsExpression | null {
  let minLat = Infinity;
  let minLng = Infinity;
  let maxLat = -Infinity;
  let maxLng = -Infinity;

  function visit(coords: unknown): void {
    if (Array.isArray(coords) && typeof coords[0] === "number") {
      const [lng, lat] = coords as [number, number];
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    } else if (Array.isArray(coords)) {
      for (const c of coords) visit(c);
    }
  }

  for (const f of fc.features) {
    const geom = f.geometry;
    if (geom && "coordinates" in geom) visit(geom.coordinates);
  }

  if (![minLat, minLng, maxLat, maxLng].every(Number.isFinite)) return null;
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

// Props: parent passes a callback to receive the clicked sector, and
// optionally a district to scope the map to (District Officers only see
// their own district, not the whole country).
interface MapViewProps {
  onSelect?: (sector: SectorProps) => void;
  district?: string;
}

export default function MapView({ onSelect, district }: MapViewProps) {
  const [data, setData] = useState<FeatureCollection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const url = district
          ? `${API_URL}/sectors?district=${encodeURIComponent(district)}`
          : `${API_URL}/sectors`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as FeatureCollection;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load sectors");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [district]);

  // Only computed when scoped to a district - the full 422-sector view keeps
  // its fixed country-level center/zoom, which already works well.
  const bounds = useMemo(
    () => (district && data ? computeBounds(data) : null),
    [district, data]
  );

  // Style each sector polygon by its risk value.
  function styleFeature(feature?: Feature<Geometry, SectorProps>) {
    const v = feature?.properties?.risk_value;
    return {
      fillColor: riskColor(v),
      fillOpacity: 0.7,
      color: "#18181b", // neutral-900 borders
      weight: 0.5,
    };
  }

  // Bind a hover tooltip AND a click handler to each sector.
  function onEachFeature(
    feature: Feature<Geometry, SectorProps>,
    layer: Layer
  ) {
    const p = feature.properties;
    const pct = p.risk_value != null ? (p.risk_value * 100).toFixed(1) : "n/a";
    const tier = riskTier(p.risk_value);
    const drivers = [p.risk_driver_1, p.risk_driver_2, p.risk_driver_3]
      .filter(Boolean)
      .join(", ");

    const html = `
      <div style="font-family: ui-sans-serif, system-ui; min-width: 180px">
        <div style="font-weight:600; margin-bottom:2px">${p.NAME_3}</div>
        <div style="color:#71717a; font-size:11px; margin-bottom:6px">
          ${p.NAME_2}, ${p.province_en}
        </div>
        <div><b>Risk:</b> ${pct}%
          ${p.is_high_risk ? `<span style="color:#dc2626">(${TIER_LABEL[tier]})</span>` : ""}
        </div>
        <div style="font-size:11px; color:#52525b; margin-top:2px">
          ${sourceLabel(p.source)}
        </div>
        ${
          drivers
            ? `<div style="font-size:11px; margin-top:4px"><b>Drivers:</b> ${drivers}</div>`
            : ""
        }
        <div style="font-size:10px; color:#3f3f46; margin-top:6px">Click for details</div>
      </div>`;

    layer.bindTooltip(html, { sticky: true });

    // Click -> report this sector's properties to the parent for the panel.
    layer.on("click", (_e: LeafletMouseEvent) => {
      if (onSelect) onSelect(p);
    });
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Loading sector data…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-red-400 font-mono text-sm">
        Could not load map data: {error}
      </div>
    );
  }

  // Scoped to a district: fit its bounds exactly (computed above). Full
  // country view: keep the fixed center/zoom that already works well.
  // MapContainer only applies whichever of these it's given ONCE, at
  // creation, so this must be right on the very first render - there's no
  // "re-fit later" step, which is exactly what makes this reliable.
  const viewProps = bounds
    ? { bounds, boundsOptions: { padding: [24, 24] as [number, number] } }
    : { center: [-1.94, 29.87] as [number, number], zoom: 9 };

  return (
    <MapContainer
      {...viewProps}
      minZoom={district ? 9 : 8}
      maxZoom={13}
      style={{ height: "100%", width: "100%", background: "#f1f5f9" }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      {data && (
        <GeoJSON
          data={data}
          style={styleFeature}
          onEachFeature={onEachFeature}
        />
      )}
    </MapContainer>
  );
}

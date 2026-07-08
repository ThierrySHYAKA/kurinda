/**
 * Kurinda - Dashboard (Officer view)
 *
 * Hosts the sector-level risk map. The map itself (MapView) is a client
 * component loaded with SSR disabled, because Leaflet requires the browser
 * `window` object and would crash during server rendering.
 *
 * Clicking a sector on the map opens a detail panel BELOW the map showing
 * that sector's risk breakdown and SHAP drivers (drill-down).
 */
"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Feature, FeatureCollection } from "geojson";
import type { SectorProps } from "./MapView";
import { useRequireRole } from "@/lib/useRequireRole";
import { OFFICER_ONLY, logout } from "@/lib/auth";

// Load the map only in the browser (ssr: false) to avoid "window is not defined".
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-neutral-400">
      Loading map...
    </div>
  ),
});

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://kurinda-backend.onrender.com";

interface Summary {
  total_sectors: number;
  high_risk_sectors: number;
  low_risk_sectors: number;
  by_source: Record<string, number>;
}

function sourceLabel(s: string): string {
  if (s === "dhs_measurement_2019_20") return "DHS measurement (2019-20)";
  if (s === "model_prediction") return "Model prediction";
  return s;
}

// Detail panel shown below the map when a sector is clicked.
function SectorDetail({
  sector,
  onClose,
}: {
  sector: SectorProps;
  onClose: () => void;
}) {
  const pct =
    sector.risk_value != null ? (sector.risk_value * 100).toFixed(1) : "n/a";
  const drivers = [
    sector.risk_driver_1,
    sector.risk_driver_2,
    sector.risk_driver_3,
  ].filter(Boolean) as string[];

  return (
    <div className="px-6 py-5 border-t border-neutral-800 bg-neutral-900/40">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-neutral-500 mb-1">
            Sector detail
          </p>
          <h2 className="text-xl font-semibold tracking-tight">
            {sector.NAME_3}
          </h2>
          <p className="text-sm text-neutral-400">
            {sector.NAME_2}, {sector.province_en}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-neutral-500 hover:text-neutral-200 text-sm"
          aria-label="Close detail panel"
        >
          Close
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        {/* Risk */}
        <div className="border border-neutral-800 rounded-lg p-4">
          <p className="text-neutral-500 mb-1">Stunting risk</p>
          <p className="text-2xl font-mono">
            {pct}%{" "}
            {sector.is_high_risk ? (
              <span className="text-red-400 text-base">high</span>
            ) : (
              <span className="text-emerald-400 text-base">low</span>
            )}
          </p>
        </div>

        {/* Source */}
        <div className="border border-neutral-800 rounded-lg p-4">
          <p className="text-neutral-500 mb-1">Data source</p>
          <p className="text-base">{sourceLabel(sector.source)}</p>
        </div>

        {/* Protective factor */}
        <div className="border border-neutral-800 rounded-lg p-4">
          <p className="text-neutral-500 mb-1">Protective factor</p>
          <p className="text-base font-mono">
            {sector.protective_factor ?? "—"}
          </p>
        </div>
      </div>

      {/* SHAP drivers */}
      <div className="mt-4">
        <p className="text-neutral-500 text-sm mb-2">
          Top risk drivers {drivers.length === 0 && "(measured sector — no model drivers)"}
        </p>
        {drivers.length > 0 ? (
          <ol className="flex flex-wrap gap-2">
            {drivers.map((d, i) => (
              <li
                key={d}
                className="font-mono text-sm border border-neutral-700 rounded px-3 py-1 bg-neutral-900"
              >
                {i + 1}. {d}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-neutral-500">
            This sector uses a direct DHS measurement, so no model-derived
            drivers apply.
          </p>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { user, ready } = useRequireRole(OFFICER_ONLY);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [selected, setSelected] = useState<SectorProps | null>(null);

  function handleLogout() {
    logout();
    router.push("/");
  }

  useEffect(() => {
    if (!ready || !user?.district) return;
    fetch(
      `${API_URL}/sectors?district=${encodeURIComponent(user.district)}`,
      { cache: "no-store" }
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data: FeatureCollection | null) => {
        if (!data) return setSummary(null);
        const props = data.features.map(
          (f: Feature) => f.properties as unknown as SectorProps
        );
        const total = props.length;
        const high = props.filter((p) => p.is_high_risk === 1).length;
        const bySource: Record<string, number> = {};
        for (const p of props) {
          bySource[p.source] = (bySource[p.source] ?? 0) + 1;
        }
        setSummary({
          total_sectors: total,
          high_risk_sectors: high,
          low_risk_sectors: total - high,
          by_source: bySource,
        });
      })
      .catch(() => setSummary(null));
  }, [ready, user]);

  if (!ready || !user) {
    return (
      <main className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center">
        <p className="text-neutral-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Header */}
      <header className="px-6 py-5 border-b border-neutral-800 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-neutral-500 mb-1">
            Kurinda &middot; District Officer View
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {user.district} District &middot; sector stunting-risk map
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Chronic childhood stunting risk across {user.district}&apos;s
            sectors. Click a sector for details.
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-neutral-500 hover:text-neutral-300">
            Home
          </Link>
          <span className="text-neutral-400">{user.name}</span>
          <button
            type="button"
            onClick={handleLogout}
            className="text-neutral-500 hover:text-red-400"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Summary stats */}
      {summary && (
        <div className="px-6 py-4 border-b border-neutral-800 flex flex-wrap gap-8 text-sm">
          <div>
            <span className="text-neutral-500">Sectors: </span>
            <span className="font-mono">{summary.total_sectors}</span>
          </div>
          <div>
            <span className="text-neutral-500">High-risk: </span>
            <span className="font-mono text-red-400">
              {summary.high_risk_sectors}
            </span>
          </div>
          <div>
            <span className="text-neutral-500">Low-risk: </span>
            <span className="font-mono text-emerald-400">
              {summary.low_risk_sectors}
            </span>
          </div>
          <div>
            <span className="text-neutral-500">Measured (DHS): </span>
            <span className="font-mono">
              {summary.by_source?.dhs_measurement_2019_20 ?? 0}
            </span>
          </div>
          <div>
            <span className="text-neutral-500">Predicted: </span>
            <span className="font-mono">
              {summary.by_source?.model_prediction ?? 0}
            </span>
          </div>
        </div>
      )}

      {/* Map + legend. Explicit fixed height so Leaflet renders (see notes). */}
      <div className="relative" style={{ height: "75vh" }}>
        <MapView onSelect={setSelected} district={user.district ?? undefined} />

        {/* Risk legend */}
        <div className="absolute bottom-4 right-4 z-[1000] bg-neutral-900/90 border border-neutral-700 rounded-lg p-3 text-xs">
          <p className="font-medium text-neutral-300 mb-2">Stunting risk</p>
          {[
            { c: "#7f1d1d", l: "50%+ (very high)" },
            { c: "#b91c1c", l: "40-50%" },
            { c: "#ea580c", l: "30-40%" },
            { c: "#f59e0b", l: "20-30%" },
            { c: "#fde047", l: "under 20%" },
            { c: "#3f3f46", l: "no data" },
          ].map((row) => (
            <div key={row.l} className="flex items-center gap-2 mb-1">
              <span
                className="inline-block w-4 h-3 rounded-sm"
                style={{ background: row.c }}
              />
              <span className="text-neutral-400">{row.l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Drill-down panel below the map (only when a sector is selected) */}
      {selected && (
        <SectorDetail sector={selected} onClose={() => setSelected(null)} />
      )}
    </main>
  );
}

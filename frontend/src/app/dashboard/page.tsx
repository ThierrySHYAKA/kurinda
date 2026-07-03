/**
 * Kurinda - Dashboard (Officer view)
 *
 * Hosts the sector-level risk map. The map itself (MapView) is a client
 * component loaded with SSR disabled, because Leaflet requires the browser
 * `window` object and would crash during server rendering.
 */
"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

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

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/sectors/summary`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setSummary)
      .catch(() => setSummary(null));
  }, []);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Header */}
      <header className="px-6 py-5 border-b border-neutral-800">
        <p className="text-xs uppercase tracking-widest text-neutral-500 mb-1">
          Kurinda &middot; District Officer View
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Sector stunting-risk map
        </h1>
        <p className="text-sm text-neutral-400 mt-1">
          Chronic childhood stunting risk across Rwanda&apos;s 422 sectors.
        </p>
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

      {/* Map + legend.
          The map container gets an EXPLICIT fixed height (not flex-1), because
          Leaflet needs a definite pixel height on its parent or it renders into
          a zero-height box (a blank/black area). height:75vh guarantees this
          regardless of the surrounding flex layout. */}
      <div className="relative" style={{ height: "75vh" }}>
        <MapView />

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
    </main>
  );
}

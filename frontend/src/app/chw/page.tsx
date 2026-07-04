/**
 * Kurinda - CHW View (Community Health Worker priority list)
 *
 * A prioritized, sortable list of all 422 sectors ranked by stunting risk,
 * highest first, so a Community Health Worker can see which villages to
 * visit first. Filterable by district. Uses the same /sectors data as the
 * officer map dashboard - no map, just the ranked list.
 *
 * Client component: it fetches on mount and manages filter/sort state.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import type { Feature, FeatureCollection } from "geojson";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://kurinda-backend.onrender.com";

// Same sector properties the map uses (from the notebook geojson build).
interface SectorProps {
  GID_3: string;
  NAME_3: string; // sector
  NAME_2: string; // district
  province_en: string; // province (English)
  risk_value: number; // 0-1
  is_high_risk: number; // 1 | 0
  source: string;
  risk_driver_1: string | null;
  risk_driver_2: string | null;
  risk_driver_3: string | null;
  protective_factor: string | null;
}

function sourceLabel(s: string): string {
  if (s === "dhs_measurement_2019_20") return "Measured";
  if (s === "model_prediction") return "Predicted";
  return s;
}

// Risk text colour matching the map ramp.
function riskTextColor(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "text-neutral-500";
  if (v >= 0.5) return "text-red-500";
  if (v >= 0.4) return "text-red-400";
  if (v >= 0.3) return "text-orange-400";
  if (v >= 0.2) return "text-amber-400";
  return "text-yellow-300";
}

export default function ChwView() {
  const [sectors, setSectors] = useState<SectorProps[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [district, setDistrict] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/sectors`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as FeatureCollection;
        const props = json.features.map(
          (f: Feature) => f.properties as unknown as SectorProps
        );
        if (!cancelled) setSectors(props);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load sectors");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // District options (sorted, unique) for the filter dropdown.
  const districts = useMemo(() => {
    if (!sectors) return [];
    return Array.from(new Set(sectors.map((s) => s.NAME_2))).sort();
  }, [sectors]);

  // Filter by district, then sort by risk descending (priority order).
  const rows = useMemo(() => {
    if (!sectors) return [];
    const filtered =
      district === "all"
        ? sectors
        : sectors.filter((s) => s.NAME_2 === district);
    return [...filtered].sort(
      (a, b) => (b.risk_value ?? 0) - (a.risk_value ?? 0)
    );
  }, [sectors, district]);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Header */}
      <header className="px-6 py-5 border-b border-neutral-800">
        <p className="text-xs uppercase tracking-widest text-neutral-500 mb-1">
          Kurinda &middot; Community Health Worker View
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Sector priority list
        </h1>
        <p className="text-sm text-neutral-400 mt-1">
          All 422 sectors ranked by stunting risk, highest first. Visit
          high-risk sectors first.
        </p>
      </header>

      {/* District filter */}
      <div className="px-6 py-4 border-b border-neutral-800 flex flex-wrap items-center gap-4 text-sm">
        <label htmlFor="district" className="text-neutral-500">
          District:
        </label>
        <select
          id="district"
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          className="bg-neutral-900 border border-neutral-700 rounded px-3 py-1.5 text-neutral-100"
        >
          <option value="all">All districts</option>
          {districts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        {sectors && (
          <span className="text-neutral-500">
            Showing <span className="font-mono">{rows.length}</span> sectors
          </span>
        )}
      </div>

      {/* States */}
      {error && (
        <div className="px-6 py-10 text-red-400 font-mono text-sm">
          Could not load sectors: {error}
        </div>
      )}
      {!sectors && !error && (
        <div className="px-6 py-10 text-neutral-400">Loading sectors...</div>
      )}

      {/* Priority table */}
      {sectors && (
        <div className="px-6 py-4 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-neutral-500 text-left border-b border-neutral-800">
                <th className="py-2 pr-4 font-medium">#</th>
                <th className="py-2 pr-4 font-medium">Sector</th>
                <th className="py-2 pr-4 font-medium">District</th>
                <th className="py-2 pr-4 font-medium">Province</th>
                <th className="py-2 pr-4 font-medium">Risk</th>
                <th className="py-2 pr-4 font-medium">Source</th>
                <th className="py-2 pr-4 font-medium">Top driver</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s, i) => {
                const pct =
                  s.risk_value != null
                    ? (s.risk_value * 100).toFixed(1)
                    : "n/a";
                return (
                  <tr
                    key={s.GID_3}
                    className="border-b border-neutral-900 hover:bg-neutral-900/50"
                  >
                    <td className="py-2 pr-4 font-mono text-neutral-500">
                      {i + 1}
                    </td>
                    <td className="py-2 pr-4 font-medium">{s.NAME_3}</td>
                    <td className="py-2 pr-4 text-neutral-400">{s.NAME_2}</td>
                    <td className="py-2 pr-4 text-neutral-400">
                      {s.province_en}
                    </td>
                    <td
                      className={`py-2 pr-4 font-mono ${riskTextColor(
                        s.risk_value
                      )}`}
                    >
                      {pct}%{" "}
                      {s.is_high_risk ? (
                        <span className="text-red-500">●</span>
                      ) : (
                        <span className="text-emerald-500">●</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-neutral-500 text-xs">
                      {sourceLabel(s.source)}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs text-neutral-400">
                      {s.risk_driver_1 ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

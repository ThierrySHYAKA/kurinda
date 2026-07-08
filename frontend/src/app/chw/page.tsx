/**
 * Kurinda - CHW Supervisor view.
 *
 * An operational, mobile-friendly list of every sector in the supervisor's
 * own district, ranked by stunting risk (highest first). Their home sector
 * is pinned at the top regardless of rank, since that's the one they're
 * personally accountable for; the rest of the district gives situational
 * awareness for escalation.
 *
 * Client component: it fetches on mount and manages sort state.
 */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Feature, FeatureCollection } from "geojson";
import { useRequireRole } from "@/lib/useRequireRole";
import { SUPERVISOR_ONLY, logout } from "@/lib/auth";

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

export default function ChwSupervisorView() {
  const { user, ready } = useRequireRole(SUPERVISOR_ONLY);
  const [sectors, setSectors] = useState<SectorProps[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !user?.district) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${API_URL}/sectors?district=${encodeURIComponent(user.district!)}`,
          { cache: "no-store" }
        );
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
  }, [ready, user]);

  // Own sector pinned first, then the rest of the district by risk descending.
  const rows = useMemo(() => {
    if (!sectors || !user) return [];
    const home = sectors.filter((s) => s.NAME_3 === user.sector);
    const rest = sectors
      .filter((s) => s.NAME_3 !== user.sector)
      .sort((a, b) => (b.risk_value ?? 0) - (a.risk_value ?? 0));
    return [...home, ...rest];
  }, [sectors, user]);

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
            Kurinda &middot; CHW Supervisor View
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {user.district} District &middot; sector priority list
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Your home sector, <span className="text-neutral-200">{user.sector}</span>,
            is pinned first. The rest of {user.district} is ranked by risk,
            highest first.
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-neutral-500 hover:text-neutral-300">
            Home
          </Link>
          <span className="text-neutral-400">{user.name}</span>
          <button
            type="button"
            onClick={logout}
            className="text-neutral-500 hover:text-red-400"
          >
            Log out
          </button>
        </div>
      </header>

      {sectors && (
        <div className="px-6 py-4 border-b border-neutral-800 text-sm text-neutral-500">
          Showing <span className="font-mono text-neutral-300">{rows.length}</span> sectors
          in {user.district}
        </div>
      )}

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
                const isHome = s.NAME_3 === user.sector;
                return (
                  <tr
                    key={s.GID_3}
                    className={`border-b border-neutral-900 hover:bg-neutral-900/50 ${
                      isHome ? "bg-emerald-950/30" : ""
                    }`}
                  >
                    <td className="py-2 pr-4 font-mono text-neutral-500">
                      {i + 1}
                    </td>
                    <td className="py-2 pr-4 font-medium">
                      {s.NAME_3}
                      {isHome && (
                        <span className="ml-2 text-xs text-emerald-400 border border-emerald-800 rounded px-1.5 py-0.5">
                          your sector
                        </span>
                      )}
                    </td>
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

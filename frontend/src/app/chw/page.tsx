/**
 * Kurinda - CHW Supervisor view.
 *
 * An operational, mobile-friendly list of every sector in the supervisor's
 * own district, ranked by stunting risk (highest first). Their home sector
 * is pinned at the top regardless of rank, since that's the one they're
 * personally accountable for; the rest of the district gives situational
 * awareness for escalation.
 *
 * Renders as stacked cards below the sm breakpoint and a table above it -
 * a wide table with horizontal scroll isn't actually usable on the feature
 * phones/small screens this view is meant for.
 *
 * Client component: it fetches on mount and manages sort state.
 */
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Feature, FeatureCollection } from "geojson";
import { useRequireRole } from "@/lib/useRequireRole";
import { SUPERVISOR_ONLY, logout } from "@/lib/auth";
import { fetchInterventions, logIntervention, type Intervention } from "@/lib/interventions";
import AppHeader from "@/components/AppHeader";
import Spinner from "@/components/Spinner";

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

function RiskDot({ isHighRisk }: { isHighRisk: number }) {
  return isHighRisk ? (
    <span className="text-red-500">●</span>
  ) : (
    <span className="text-emerald-500">●</span>
  );
}

// Small "N visits" badge, shown next to a sector name once at least one
// visit has been logged for it.
function VisitBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="shrink-0 text-xs text-neutral-400 border border-neutral-700 rounded px-1.5 py-0.5">
      {count} visit{count === 1 ? "" : "s"}
    </span>
  );
}

export default function ChwSupervisorView() {
  const router = useRouter();
  const { user, ready } = useRequireRole(SUPERVISOR_ONLY);
  const [sectors, setSectors] = useState<SectorProps[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [loggingSector, setLoggingSector] = useState<string | null>(null);

  function handleLogout() {
    logout();
    router.push("/");
  }

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

  useEffect(() => {
    if (!ready || !user?.district) return;
    fetchInterventions({ district: user.district })
      .then(setInterventions)
      .catch(() => setInterventions([]));
  }, [ready, user]);

  const visitCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const i of interventions) {
      counts[i.sector] = (counts[i.sector] ?? 0) + 1;
    }
    return counts;
  }, [interventions]);

  async function markVisit(sector: string) {
    setLoggingSector(sector);
    try {
      const row = await logIntervention(sector);
      setInterventions((prev) => [row, ...prev]);
    } catch {
      // non-fatal - the count just won't update; the supervisor can retry
    } finally {
      setLoggingSector(null);
    }
  }

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
        <Spinner label="Loading…" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <AppHeader
        eyebrow="Kurinda · CHW Supervisor View"
        title={`${user.district} District · sector priority list`}
        subtitle={`Your home sector, ${user.sector}, is pinned first. The rest of ${user.district} is ranked by risk, highest first.`}
        userName={user.name}
        onLogout={handleLogout}
      />

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
        <div className="px-6 py-10">
          <Spinner label="Loading sectors…" />
        </div>
      )}

      {sectors && (
        <>
          {/* Mobile: stacked cards */}
          <div className="sm:hidden divide-y divide-neutral-900">
            {rows.map((s, i) => {
              const pct =
                s.risk_value != null ? (s.risk_value * 100).toFixed(1) : "n/a";
              const isHome = s.NAME_3 === user.sector;
              return (
                <div
                  key={s.GID_3}
                  className={`px-6 py-3 ${isHome ? "bg-emerald-950/30" : ""}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-neutral-500 font-mono text-xs shrink-0">
                        {i + 1}
                      </span>
                      <span className="font-medium truncate">{s.NAME_3}</span>
                      {isHome && (
                        <span className="shrink-0 text-xs text-emerald-400 border border-emerald-800 rounded px-1.5 py-0.5">
                          your sector
                        </span>
                      )}
                    </div>
                    <span
                      className={`font-mono text-sm shrink-0 ${riskTextColor(
                        s.risk_value
                      )}`}
                    >
                      {pct}% <RiskDot isHighRisk={s.is_high_risk} />
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-neutral-500 flex flex-wrap items-center gap-x-2">
                    <span>{s.province_en}</span>
                    <span>&middot;</span>
                    <span>{sourceLabel(s.source)}</span>
                    {s.risk_driver_1 && (
                      <>
                        <span>&middot;</span>
                        <span className="font-mono text-neutral-400">
                          {s.risk_driver_1}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <VisitBadge count={visitCounts[s.NAME_3] ?? 0} />
                    <button
                      type="button"
                      onClick={() => markVisit(s.NAME_3)}
                      disabled={loggingSector === s.NAME_3}
                      className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50 transition-colors"
                    >
                      {loggingSector === s.NAME_3 ? "Marking…" : "+ Mark visit complete"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block px-6 py-4 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-neutral-500 text-left border-b border-neutral-800">
                  <th className="py-2 pr-4 font-medium">#</th>
                  <th className="py-2 pr-4 font-medium">Sector</th>
                  <th className="py-2 pr-4 font-medium">Province</th>
                  <th className="py-2 pr-4 font-medium">Risk</th>
                  <th className="py-2 pr-4 font-medium">Source</th>
                  <th className="py-2 pr-4 font-medium">Top driver</th>
                  <th className="py-2 pr-4 font-medium">Visits</th>
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
                      className={`border-b border-neutral-900 hover:bg-neutral-900/50 transition-colors ${
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
                        {pct}% <RiskDot isHighRisk={s.is_high_risk} />
                      </td>
                      <td className="py-2 pr-4 text-neutral-500 text-xs">
                        {sourceLabel(s.source)}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs text-neutral-400">
                        {s.risk_driver_1 ?? "—"}
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <VisitBadge count={visitCounts[s.NAME_3] ?? 0} />
                          <button
                            type="button"
                            onClick={() => markVisit(s.NAME_3)}
                            disabled={loggingSector === s.NAME_3}
                            className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50 transition-colors whitespace-nowrap"
                          >
                            {loggingSector === s.NAME_3 ? "Marking…" : "+ Mark visit"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}

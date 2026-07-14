/**
 * Kurinda - Dashboard (Officer view)
 *
 * Hosts the sector-level risk map. The map itself (MapView) is a client
 * component loaded with SSR disabled, because Leaflet requires the browser
 * `window` object and would crash during server rendering.
 *
 * Map + detail panel sit side by side on large screens; the panel opens
 * below the map on smaller ones (see the layout further down).
 */
"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import type { Feature, FeatureCollection } from "geojson";
import type { SectorProps } from "./MapView";
import { useRequireRole } from "@/lib/useRequireRole";
import { OFFICER_ONLY, logout } from "@/lib/auth";
import { fetchInterventions, logIntervention, type Intervention } from "@/lib/interventions";
import { exportPriorityReport } from "@/lib/pdfExport";
import AppHeader from "@/components/AppHeader";
import StatTile from "@/components/StatTile";
import Spinner from "@/components/Spinner";
import RiskBadge from "@/components/RiskBadge";

// Load the map only in the browser (ssr: false) to avoid "window is not defined".
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Spinner label="Loading map…" />
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

// Detail panel shown alongside (or below, on small screens) the map when a
// sector is clicked.
function SectorDetail({
  sector,
  onClose,
  interventions,
  onLogged,
}: {
  sector: SectorProps;
  onClose: () => void;
  interventions: Intervention[];
  onLogged: (row: Intervention) => void;
}) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  const pct =
    sector.risk_value != null ? (sector.risk_value * 100).toFixed(1) : "n/a";
  const drivers = [
    sector.risk_driver_1,
    sector.risk_driver_2,
    sector.risk_driver_3,
  ].filter(Boolean) as string[];

  async function handleLog(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setLogError(null);
    try {
      const row = await logIntervention(sector.NAME_3, note);
      onLogged(row);
      setNote("");
    } catch (err) {
      setLogError(err instanceof Error ? err.message : "Failed to log intervention");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-6 py-5 border-t border-slate-800 lg:border-t-0 bg-slate-900/40 animate-[fadeIn_0.15s_ease-out]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">
            Sector detail
          </p>
          <h2 className="text-xl font-semibold tracking-tight">
            {sector.NAME_3}
          </h2>
          <p className="text-sm text-slate-400">
            {sector.NAME_2}, {sector.province_en}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-500 hover:text-slate-200 text-sm transition-colors"
          aria-label="Close detail panel"
        >
          Close
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 text-sm">
        {/* Risk */}
        <div className="border border-slate-800 rounded-lg p-4">
          <p className="text-slate-500 mb-1">Stunting risk</p>
          <p className="text-2xl font-mono flex items-center gap-2 flex-wrap">
            {pct}%
            <RiskBadge value={sector.risk_value} />
          </p>
        </div>

        {/* Source */}
        <div className="border border-slate-800 rounded-lg p-4">
          <p className="text-slate-500 mb-1">Data source</p>
          <p className="text-base">{sourceLabel(sector.source)}</p>
        </div>

        {/* Protective factor */}
        <div className="border border-slate-800 rounded-lg p-4">
          <p className="text-slate-500 mb-1">Protective factor</p>
          <p className="text-base font-mono">
            {sector.protective_factor ?? "—"}
          </p>
        </div>
      </div>

      {/* SHAP drivers */}
      <div className="mt-4">
        <p className="text-slate-500 text-sm mb-2">
          Top risk drivers {drivers.length === 0 && "(measured sector — no model drivers)"}
        </p>
        {drivers.length > 0 ? (
          <ol className="flex flex-wrap gap-2">
            {drivers.map((d, i) => (
              <li
                key={d}
                className="font-mono text-sm border border-slate-700 rounded-full px-3 py-1 bg-slate-900 hover:border-slate-500 transition-colors"
              >
                <span className="text-slate-500 mr-1">{i + 1}.</span>
                {d}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-slate-500">
            This sector uses a direct DHS measurement, so no model-derived
            drivers apply.
          </p>
        )}
      </div>

      {/* Interventions */}
      <div className="mt-4">
        <p className="text-slate-500 text-sm mb-2">
          Interventions {interventions.length > 0 && `(${interventions.length})`}
        </p>
        {interventions.length > 0 ? (
          <ul className="space-y-2 mb-3">
            {interventions.map((i) => (
              <li
                key={i.id}
                className="text-sm border border-slate-800 rounded-lg p-3 bg-slate-950/40"
              >
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>{i.logged_by_name}</span>
                  <span>{new Date(i.created_at).toLocaleDateString()}</span>
                </div>
                {i.note && <p className="text-slate-300">{i.note}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500 mb-3">
            No interventions logged yet for this sector.
          </p>
        )}

        <form onSubmit={handleLog} className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Optional note (e.g. what was done, households reached)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="flex-1 min-w-[200px] bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 transition-colors focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 rounded px-4 py-2 text-sm font-semibold transition-colors"
          >
            {submitting && (
              <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-slate-950/40 border-t-slate-950 animate-spin" />
            )}
            {submitting ? "Logging…" : "Log intervention"}
          </button>
        </form>
        {logError && (
          <p className="text-sm text-red-400 mt-2">{logError}</p>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { user, ready } = useRequireRole(OFFICER_ONLY);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [sectors, setSectors] = useState<SectorProps[]>([]);
  const [selected, setSelected] = useState<SectorProps | null>(null);
  const [interventions, setInterventions] = useState<Intervention[]>([]);

  function handleLogout() {
    logout();
    router.push("/");
  }

  function handleExport() {
    if (!user?.district) return;
    exportPriorityReport({
      district: user.district,
      sectors,
      interventions,
      officerName: user.name,
    });
  }

  useEffect(() => {
    if (!ready || !user?.district) return;
    fetchInterventions({ district: user.district })
      .then(setInterventions)
      .catch(() => setInterventions([]));
  }, [ready, user]);

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
        setSectors(props);
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
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <Spinner label="Loading…" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <AppHeader
        eyebrow="Kurinda · District Officer View"
        title={`${user.district} District · sector stunting-risk map`}
        subtitle={`Chronic childhood stunting risk across ${user.district}'s sectors. Click a sector for details.`}
        userName={user.name}
        onLogout={handleLogout}
      />

      {/* Summary stats + export */}
      {summary && (
        <div className="px-6 py-4 border-b border-slate-800 flex flex-wrap items-end justify-between gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 flex-1">
            <StatTile label="Sectors" value={summary.total_sectors} />
            <StatTile
              label="High-risk"
              value={summary.high_risk_sectors}
              accent="red"
            />
            <StatTile
              label="Low-risk"
              value={summary.low_risk_sectors}
              accent="emerald"
            />
            <StatTile
              label="Measured (DHS)"
              value={summary.by_source?.dhs_measurement_2019_20 ?? 0}
            />
            <StatTile
              label="Predicted"
              value={summary.by_source?.model_prediction ?? 0}
              accent="cyan"
            />
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={sectors.length === 0}
            className="shrink-0 border border-slate-700 hover:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 rounded px-4 py-2 text-sm font-medium transition-colors"
          >
            ↓ Export priority report (PDF)
          </button>
        </div>
      )}

      {/*
        Map + detail panel side by side on large screens (persistent right
        panel, no scrolling needed to see both at once); stacked on smaller
        screens, where the panel only appears once a sector is selected.
      */}
      <div className="flex flex-col lg:flex-row lg:h-[75vh]">
        {/* Map + legend. Explicit height so Leaflet renders (see notes). */}
        <div className="relative h-[60vh] lg:h-full lg:flex-1">
          <MapView onSelect={setSelected} district={user.district ?? undefined} />

          {/* Risk legend - these colours are the risk scale itself, not
              brand colours, so they stay fixed regardless of theme. */}
          <div className="absolute bottom-4 right-4 z-[1000] bg-slate-900/90 border border-slate-700 rounded-lg p-3 text-xs">
            <p className="font-medium text-slate-300 mb-2">Stunting risk</p>
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
                <span className="text-slate-400">{row.l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel: persistent on lg+ (empty state when nothing
            selected), only rendered on smaller screens once selected. */}
        <div className="lg:w-[420px] lg:shrink-0 lg:border-l lg:border-slate-800 lg:h-full lg:overflow-y-auto">
          {selected ? (
            <SectorDetail
              sector={selected}
              onClose={() => setSelected(null)}
              interventions={interventions.filter((i) => i.sector === selected.NAME_3)}
              onLogged={(row) => setInterventions((prev) => [row, ...prev])}
            />
          ) : (
            <div className="hidden lg:flex h-full items-center justify-center px-6 text-center">
              <p className="text-sm text-slate-500">
                Click a sector on the map to see its risk, SHAP drivers, and
                intervention history.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

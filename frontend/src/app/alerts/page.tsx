/**
 * Kurinda - CHW SMS Alerts page.
 *
 * An interactive view of the SMS alert channel: the user picks how many of the
 * highest-risk sectors to alert, sees exactly which sectors that will be
 * before sending (mirrors the backend's own selection so the preview is
 * never wrong), clicks Send, and the page calls the backend POST
 * /alerts/send endpoint (Africa's Talking) and shows delivery status per
 * sector. Makes the SMS feature visible and demoable in the UI rather than
 * only via the API docs.
 */
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Feature, FeatureCollection } from "geojson";
import { useRequireRole } from "@/lib/useRequireRole";
import { CHW_ONLY, logout } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import Spinner from "@/components/Spinner";
import RiskBadge from "@/components/RiskBadge";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://kurinda-backend.onrender.com";

interface SectorResult {
  sector: string;
  status: string;
  error?: string;
}

interface SendResponse {
  sent: number;
  recipient?: string;
  sectors: SectorResult[];
  detail?: string;
}

// Mirrors /sectors from the map; only the fields this page actually uses.
interface SectorProps {
  GID_3: string;
  NAME_3: string;
  risk_value: number;
  is_high_risk: number;
}

export default function AlertsPage() {
  const router = useRouter();
  const { user, ready } = useRequireRole(CHW_ONLY);
  const [limit, setLimit] = useState(5);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SendResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sectors, setSectors] = useState<SectorProps[] | null>(null);

  function handleLogout() {
    logout();
    router.push("/");
  }

  // Nationwide (unscoped), same as the backend picks from - CHW alerts
  // aren't limited to one district.
  useEffect(() => {
    fetch(`${API_URL}/sectors`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: FeatureCollection | null) => {
        if (!data) return;
        setSectors(
          data.features.map((f: Feature) => f.properties as unknown as SectorProps)
        );
      })
      .catch(() => setSectors(null));
  }, []);

  // Exactly mirrors backend/main.py's send_alerts() selection: high-risk
  // sectors sorted by risk_value descending, top `limit` - so the preview
  // is never wrong about who's about to be messaged.
  const preview = useMemo(() => {
    if (!sectors) return [];
    return [...sectors]
      .filter((s) => s.is_high_risk === 1)
      .sort((a, b) => (b.risk_value ?? 0) - (a.risk_value ?? 0))
      .slice(0, limit);
  }, [sectors, limit]);

  async function sendAlerts() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_URL}/alerts/send?limit=${limit}`, {
        method: "POST",
        headers: { accept: "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail ?? `HTTP ${res.status}`);
      }
      setResult(data as SendResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send alerts");
    } finally {
      setLoading(false);
    }
  }

  if (!ready || !user) {
    return (
      <main className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center">
        <Spinner label="Loading…" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <AppHeader
        eyebrow="Kurinda · Community Health Worker Alerts"
        title="Send SMS risk alerts"
        subtitle="Sends a Kinyarwanda risk-alert SMS for the highest-risk sectors nationwide via Africa's Talking. In this build all messages go to a single test recipient (the sandbox simulator)."
        userName={`${user.name} · ${user.sector}`}
        onLogout={handleLogout}
      />

      <div className="max-w-3xl px-6 py-8">
        {/* Controls */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-5 bg-slate-50 dark:bg-slate-900/40">
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="limit" className="text-xs text-slate-500">
              Number of top sectors to alert
            </label>
            <span className="font-mono text-lg text-slate-900 dark:text-slate-100">{limit}</span>
          </div>
          <input
            id="limit"
            type="range"
            min={1}
            max={20}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="w-full accent-cyan-400"
          />
          <div className="flex justify-between text-xs text-slate-600 mb-4">
            <span>1</span>
            <span>20</span>
          </div>

          <button
            type="button"
            onClick={sendAlerts}
            disabled={loading || preview.length === 0}
            className="inline-flex items-center gap-2 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 rounded px-5 py-2 text-sm font-semibold transition-colors"
          >
            {loading && (
              <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-slate-950/40 border-t-slate-950 animate-spin" />
            )}
            {loading ? "Sending…" : `Send alerts to ${preview.length} sectors`}
          </button>
        </div>

        {/* Preview - exactly who's about to be alerted, before sending */}
        {sectors && (
          <div className="mt-6">
            <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">
              Preview recipients
            </p>
            {preview.length > 0 ? (
              <ul className="divide-y divide-slate-200 dark:divide-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                {preview.map((s) => (
                  <li
                    key={s.GID_3}
                    className="flex items-center justify-between px-4 py-2.5 text-sm"
                  >
                    <span className="font-medium">{s.NAME_3}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-600 dark:text-slate-400">
                        {(s.risk_value * 100).toFixed(1)}%
                      </span>
                      <RiskBadge value={s.risk_value} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">
                No high-risk sectors found nationwide.
              </p>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-6 border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 rounded-lg p-4 text-sm text-red-700 dark:text-red-300 font-mono animate-[fadeIn_0.15s_ease-out]">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="mt-6 animate-[fadeIn_0.15s_ease-out]">
            <p className="text-sm mb-3">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                {result.sent}
              </span>{" "}
              alert{result.sent === 1 ? "" : "s"} sent
              {result.recipient && (
                <span className="text-slate-500">
                  {" "}
                  to {result.recipient}
                </span>
              )}
              {result.detail && (
                <span className="text-slate-500"> — {result.detail}</span>
              )}
            </p>
            <ul className="divide-y divide-slate-200 dark:divide-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              {result.sectors.map((s, i) => (
                <li
                  key={`${s.sector}-${i}`}
                  className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                >
                  <span className="font-medium">{s.sector}</span>
                  {s.status === "sent" ? (
                    <span className="text-emerald-600 dark:text-emerald-400">● sent</span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400" title={s.error}>
                      ● failed
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}

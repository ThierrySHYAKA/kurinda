/**
 * Kurinda - CHW SMS Alerts page.
 *
 * An interactive view of the SMS alert channel: the user picks how many of the
 * highest-risk sectors to alert, clicks Send, and the page calls the backend
 * POST /alerts/send endpoint (Africa's Talking) and shows which sectors were
 * alerted and the send status. Makes the SMS feature visible and demoable in
 * the UI rather than only via the API docs.
 */
"use client";

import Link from "next/link";
import { useState } from "react";
import { useRequireRole } from "@/lib/useRequireRole";
import { CHW_ONLY, logout } from "@/lib/auth";

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

export default function AlertsPage() {
  const { user, ready } = useRequireRole(CHW_ONLY);
  const [limit, setLimit] = useState(5);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SendResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      <main className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center">
        <p className="text-neutral-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-6 py-10 sm:px-12">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-neutral-500 hover:text-neutral-300"
          >
            ← Home
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-neutral-400">
              {user.name} &middot; {user.sector}
            </span>
            <button
              type="button"
              onClick={logout}
              className="text-neutral-500 hover:text-red-400"
            >
              Log out
            </button>
          </div>
        </div>

        <p className="text-xs uppercase tracking-widest text-neutral-500 mt-6 mb-1">
          Kurinda &middot; Community Health Worker Alerts
        </p>
        <h1 className="text-2xl font-semibold tracking-tight mb-2">
          Send SMS risk alerts
        </h1>
        <p className="text-sm text-neutral-400 mb-8 leading-relaxed">
          Sends a Kinyarwanda risk-alert SMS for the highest-risk sectors via
          Africa&apos;s Talking. In this build all messages go to a single test
          recipient (the sandbox simulator).
        </p>

        {/* Controls */}
        <div className="flex flex-wrap items-end gap-4 border border-neutral-800 rounded-lg p-5 bg-neutral-900/40">
          <div>
            <label
              htmlFor="limit"
              className="block text-xs text-neutral-500 mb-1"
            >
              Number of top sectors to alert
            </label>
            <input
              id="limit"
              type="number"
              min={1}
              max={20}
              value={limit}
              onChange={(e) =>
                setLimit(Math.max(1, Math.min(20, Number(e.target.value))))
              }
              className="w-24 bg-neutral-900 border border-neutral-700 rounded px-3 py-1.5 text-neutral-100"
            />
          </div>
          <button
            onClick={sendAlerts}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded px-5 py-2 text-sm font-medium"
          >
            {loading ? "Sending…" : "Send alerts"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 border border-red-900 bg-red-950/40 rounded-lg p-4 text-sm text-red-300 font-mono">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="mt-6">
            <p className="text-sm mb-3">
              <span className="text-emerald-400 font-semibold">
                {result.sent}
              </span>{" "}
              alert{result.sent === 1 ? "" : "s"} sent
              {result.recipient && (
                <span className="text-neutral-500">
                  {" "}
                  to {result.recipient}
                </span>
              )}
              {result.detail && (
                <span className="text-neutral-500"> — {result.detail}</span>
              )}
            </p>
            <ul className="divide-y divide-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
              {result.sectors.map((s, i) => (
                <li
                  key={`${s.sector}-${i}`}
                  className="flex items-center justify-between px-4 py-2.5 text-sm"
                >
                  <span className="font-medium">{s.sector}</span>
                  {s.status === "sent" ? (
                    <span className="text-emerald-400">● sent</span>
                  ) : (
                    <span className="text-red-400" title={s.error}>
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

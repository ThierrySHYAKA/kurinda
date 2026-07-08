/**
 * Kurinda - Home / landing page.
 *
 * Project name, description, live backend status, live sector-risk stats,
 * and a Get Started / Log in entry point. Each role's dashboard is gated
 * (see lib/useRequireRole) so this page no longer links straight into them —
 * it links into registration, pre-selecting the role from the card clicked.
 *
 * Client component so it can fetch live backend status + stats on mount.
 */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getStoredUser, logout, ROLE_HOME, ROLE_LABEL, type AuthUser, type UserRole } from "@/lib/auth";
import StatTile from "@/components/StatTile";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://kurinda-backend.onrender.com";

interface ApiStatus {
  service?: string;
  version?: string;
  status?: string;
  error?: string;
}

interface Summary {
  total_sectors: number;
  high_risk_sectors: number;
  low_risk_sectors: number;
  by_source: Record<string, number>;
}

const ROLE_CARDS: { role: UserRole; label: string; audience: string; desc: string }[] = [
  {
    role: "district_officer",
    label: "District Officer View",
    audience: "For district nutrition officers",
    desc:
      "Interactive risk map of your district's sectors, colour-coded by predicted stunting risk, with click-through drill-down and SHAP explanations.",
  },
  {
    role: "chw_supervisor",
    label: "CHW Supervisor View",
    audience: "For community health worker supervisors",
    desc:
      "Risk-ranked list of your district's sectors, your own sector pinned first, plus a chatbot assistant grounded in Kurinda's data.",
  },
  {
    role: "chw",
    label: "CHW SMS Alerts",
    audience: "For rural community health workers",
    desc:
      "Kinyarwanda risk-alert SMS for your sector via Africa's Talking, for CHWs using feature phones — no app required.",
  },
];

export default function Home() {
  const [api, setApi] = useState<ApiStatus | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { error: `HTTP ${r.status}` }))
      .then(setApi)
      .catch((e) =>
        setApi({ error: e instanceof Error ? e.message : "unreachable" })
      );
    fetch(`${API_URL}/sectors/summary`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setSummary)
      .catch(() => setSummary(null));
    setUser(getStoredUser());
  }, []);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-6 py-16 sm:px-12 lg:px-24">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <p className="text-sm uppercase tracking-widest text-neutral-500 mb-4">
          Capstone &middot; BSc Software Engineering &middot; ALU
        </p>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-4 bg-gradient-to-r from-neutral-100 to-emerald-400 bg-clip-text text-transparent">
          Kurinda
        </h1>
        <p className="text-lg text-neutral-300 mb-8 leading-relaxed max-w-3xl">
          A machine learning early-warning system that predicts sector-level
          chronic childhood stunting risk in Rwanda, delivered through three
          channels for the people who act on it.
        </p>

        {/* Primary call to action */}
        <div className="flex flex-wrap items-center gap-4 mb-8">
          {user ? (
            <Link
              href={ROLE_HOME[user.role]}
              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-6 py-2.5 text-sm font-medium transition-colors"
            >
              Continue to my dashboard →
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-6 py-2.5 text-sm font-medium transition-colors"
              >
                Get started
              </Link>
              <Link
                href="/login"
                className="border border-neutral-700 hover:border-neutral-500 text-neutral-200 rounded-lg px-6 py-2.5 text-sm font-medium transition-colors"
              >
                Log in
              </Link>
            </>
          )}
        </div>

        {/* Backend status + account pills */}
        <div className="flex flex-wrap items-center gap-3 mb-10">
          <div className="inline-flex items-center gap-2 border border-neutral-800 rounded-full px-4 py-1.5 text-sm font-mono">
            <span className="text-neutral-500">backend:</span>
            {api == null ? (
              <span className="text-neutral-400">checking…</span>
            ) : api.error ? (
              <span className="text-red-400">✗ {api.error}</span>
            ) : (
              <span className="text-emerald-400">● {api.status}</span>
            )}
          </div>

          {user && (
            <div className="inline-flex items-center gap-3 border border-neutral-800 rounded-full px-4 py-1.5 text-sm">
              <span className="text-neutral-300">
                {user.name} &middot; {ROLE_LABEL[user.role]}
              </span>
              <button
                type="button"
                onClick={() => {
                  logout();
                  setUser(null);
                }}
                className="text-neutral-500 hover:text-red-400 transition-colors"
              >
                Log out
              </button>
            </div>
          )}
        </div>

        {/* Live stats */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-14">
            <StatTile label="Sectors tracked" value={summary.total_sectors} />
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
              label="DHS-measured"
              value={summary.by_source?.dhs_measurement_2019_20 ?? 0}
            />
            <StatTile
              label="Model-predicted"
              value={summary.by_source?.model_prediction ?? 0}
            />
          </div>
        )}

        {/* Role cards -> registration, role pre-selected */}
        <p className="text-xs uppercase tracking-widest text-neutral-500 mb-4">
          Three channels, one system
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-5">
          {ROLE_CARDS.map((c) => (
            <Link key={c.role} href={`/register?role=${c.role}`} className="group">
              <div className="h-full border border-neutral-800 rounded-xl p-6 bg-neutral-900/40 hover:bg-neutral-900 hover:border-neutral-600 hover:-translate-y-0.5 transition-all duration-200">
                <p className="text-xs uppercase tracking-widest text-neutral-500 mb-2">
                  {c.audience}
                </p>
                <h2 className="text-xl font-semibold mb-2 flex items-center gap-1.5">
                  {c.label}
                  <span className="text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    →
                  </span>
                </h2>
                <p className="text-sm text-neutral-400 leading-relaxed">
                  {c.desc}
                </p>
              </div>
            </Link>
          ))}
        </div>
        <a
          href={`${API_URL}/docs`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          Backend API docs ↗
        </a>

        {/* Footer */}
        <footer className="mt-16 text-sm text-neutral-500">
          <p>Thierry SHYAKA &middot; Supervisor: Dirac Murairi &middot; 2026</p>
        </footer>
      </div>
    </main>
  );
}

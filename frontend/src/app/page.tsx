/**
 * Kurinda - Home / landing page.
 *
 * Project name, description, live backend status, a live nationwide risk
 * snapshot, the data pipeline, and the three role-gated entry points. Each
 * role's dashboard is gated (see lib/useRequireRole) so this page never
 * links straight into them - it links into registration, pre-selecting the
 * role from the card clicked.
 *
 * Client component so it can fetch live backend status + stats on mount.
 */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getStoredUser, logout, ROLE_HOME, ROLE_LABEL, type AuthUser, type UserRole } from "@/lib/auth";
import StatTile from "@/components/StatTile";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";

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

const PIPELINE = [
  {
    n: "01",
    title: "Ingest",
    desc: "DHS household surveys, agricultural production, market food prices, and satellite rainfall/vegetation data, joined at the sector level across all 422 Rwandan sectors.",
  },
  {
    n: "02",
    title: "Predict",
    desc: "A LightGBM model outputs a stunting-risk score per sector, plus SHAP-based top risk drivers explaining why.",
  },
  {
    n: "03",
    title: "Intervene",
    desc: "Officers drill into any sector, log interventions, and dispatch Kinyarwanda SMS alerts to field CHWs.",
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

  const primaryHref = user ? ROLE_HOME[user.role] : "/register";
  const primaryLabel = user ? "Continue to my dashboard" : "Get started";

  return (
    <main className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top nav */}
      <header className="border-b border-slate-200 dark:border-slate-900 px-6 sm:px-12 lg:px-24 py-5 flex flex-wrap items-center justify-between gap-y-3">
        <Logo />
        <nav className="hidden sm:flex items-center gap-6 text-sm text-slate-600 dark:text-slate-400">
          <a href="#how-it-works" className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
            How it works
          </a>
          {user ? (
            <Link href={ROLE_HOME[user.role]} className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
              Dashboard
            </Link>
          ) : (
            <Link href="/login" className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
              Log in
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href={primaryHref}
            className="bg-cyan-400 hover:bg-cyan-300 text-slate-950 rounded px-4 py-2 text-sm font-semibold transition-colors"
          >
            {user ? "Dashboard" : "Get started"}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="px-6 sm:px-12 lg:px-24 py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-cyan-600 dark:text-cyan-400 mb-4 font-mono">
              Rwanda &middot; 422 sectors &middot; BSc capstone project
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6 leading-[1.1]">
              Predict childhood stunting{" "}
              <span className="text-cyan-600 dark:text-cyan-400">before</span> it becomes
              irreversible.
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 leading-relaxed max-w-xl">
              Kurinda is a machine-learning early-warning system for Rwanda&apos;s
              nutrition officers and community health workers — one map, one
              risk score, one intervention log per sector.
            </p>

            <div className="flex flex-wrap items-center gap-4 mb-8">
              <Link
                href={primaryHref}
                className="bg-cyan-400 hover:bg-cyan-300 text-slate-950 rounded-lg px-6 py-2.5 text-sm font-semibold transition-colors"
              >
                {primaryLabel} →
              </Link>
              {!user && (
                <Link
                  href="/login"
                  className="border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 text-slate-700 dark:text-slate-200 rounded-lg px-6 py-2.5 text-sm font-medium transition-colors"
                >
                  Log in
                </Link>
              )}
            </div>

            {/* Backend status + account pills */}
            <div className="flex flex-wrap items-center gap-3 mb-10">
              <div className="inline-flex items-center gap-2 border border-slate-200 dark:border-slate-800 rounded-full px-4 py-1.5 text-sm font-mono">
                <span className="text-slate-500">backend:</span>
                {api == null ? (
                  <span className="text-slate-500 dark:text-slate-400">checking…</span>
                ) : api.error ? (
                  <span className="text-red-600 dark:text-red-400">✗ {api.error}</span>
                ) : (
                  <span className="text-cyan-600 dark:text-cyan-400">● {api.status}</span>
                )}
              </div>

              {user && (
                <div className="inline-flex items-center gap-3 border border-slate-200 dark:border-slate-800 rounded-full px-4 py-1.5 text-sm">
                  <span className="text-slate-700 dark:text-slate-300">
                    {user.name} &middot; {ROLE_LABEL[user.role]}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      setUser(null);
                    }}
                    className="text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>

            {/* Real, honestly-reported headline stats */}
            <div className="flex flex-wrap gap-8">
              <div>
                <p className="text-3xl font-bold font-mono">422</p>
                <p className="text-sm text-slate-500">Sectors covered</p>
              </div>
              <div>
                <p className="text-3xl font-bold font-mono text-cyan-600 dark:text-cyan-400">96%</p>
                <p className="text-sm text-slate-500">High-risk recall</p>
              </div>
              <div>
                <p className="text-3xl font-bold font-mono">5</p>
                <p className="text-sm text-slate-500">Data sources fused</p>
              </div>
            </div>
          </div>

          {/* Live nationwide snapshot - real data, not a mockup */}
          <div className="min-w-0 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900/40 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
              <span className="h-2 w-2 rounded-full bg-red-500/70" />
              <span className="h-2 w-2 rounded-full bg-amber-500/70" />
              <span className="h-2 w-2 rounded-full bg-emerald-500/70" />
              <span className="ml-2 text-xs font-mono uppercase tracking-widest text-slate-500">
                Nationwide &middot; live
              </span>
            </div>
            {summary ? (
              <div className="p-4 grid grid-cols-2 gap-3">
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
                  accent="cyan"
                />
              </div>
            ) : (
              <div className="p-6 text-sm text-slate-500">Loading live data…</div>
            )}
          </div>
        </div>
      </div>

      {/* Pipeline */}
      <section id="how-it-works" className="border-t border-slate-200 dark:border-slate-900 px-6 sm:px-12 lg:px-24 py-16">
        <div>
          <p className="text-xs uppercase tracking-widest text-cyan-600 dark:text-cyan-400 mb-2 font-mono">
            The pipeline
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-10 max-w-2xl">
            From household surveys to a sector-level score you can act on
            today.
          </h2>
          <div className="grid sm:grid-cols-3 gap-5">
            {PIPELINE.map((step) => (
              <div
                key={step.n}
                className="border border-slate-200 dark:border-slate-800 rounded-xl p-6 bg-slate-50 dark:bg-slate-900/30"
              >
                <p className="text-xs font-mono text-cyan-600 dark:text-cyan-400 mb-3">{step.n}</p>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles -> registration, role pre-selected */}
      <section id="roles" className="border-t border-slate-200 dark:border-slate-900 px-6 sm:px-12 lg:px-24 py-16">
        <div>
          <p className="text-xs uppercase tracking-widest text-cyan-600 dark:text-cyan-400 mb-2 font-mono">
            Three roles, one system
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-10 max-w-2xl">
            Each user sees only their world.
          </h2>
          <div className="grid sm:grid-cols-3 gap-5">
            {ROLE_CARDS.map((c) => (
              <Link key={c.role} href={`/register?role=${c.role}`} className="group">
                <div className="h-full border border-slate-200 dark:border-slate-800 rounded-xl p-6 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600 hover:-translate-y-0.5 transition-all duration-200">
                  <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">
                    {c.audience}
                  </p>
                  <h3 className="text-xl font-semibold mb-2 flex items-center gap-1.5">
                    {c.label}
                    <span className="text-cyan-600 dark:text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      →
                    </span>
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {c.desc}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-900 px-6 sm:px-12 lg:px-24 py-8 flex flex-wrap items-center justify-end gap-4 text-sm text-slate-500">
        <Link
          href="/privacy"
          className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
        >
          Privacy Policy &amp; Terms of Use
        </Link>
        <a
          href={`${API_URL}/docs`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
        >
          Backend API docs ↗
        </a>
      </footer>
    </main>
  );
}

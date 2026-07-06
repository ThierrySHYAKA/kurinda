/**
 * Kurinda - Home / navigation hub.
 *
 * The landing page for the system: a live backend-status indicator plus entry
 * points to the three user-facing channels (District Officer dashboard, CHW
 * supervisor priority list, CHW SMS alerts) and the backend API docs.
 *
 * Client component so it can fetch the live backend status on mount.
 */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://kurinda-backend.onrender.com";

interface ApiStatus {
  service?: string;
  version?: string;
  status?: string;
  error?: string;
}

// The four entry points shown as cards on the home page.
const CHANNELS = [
  {
    href: "/dashboard",
    external: false,
    label: "District Officer View",
    audience: "For district nutrition officers",
    desc:
      "Interactive risk map of all 422 sectors, colour-coded by predicted stunting risk, with click-through drill-down and SHAP explanations.",
  },
  {
    href: "/chw",
    external: false,
    label: "CHW Supervisor View",
    audience: "For community health worker supervisors",
    desc:
      "Risk-ranked list of every sector, filterable by district, so supervisors know which villages to prioritise first.",
  },
  {
    href: "/alerts",
    external: false,
    label: "CHW SMS Alerts",
    audience: "For rural community health workers",
    desc:
      "Send Kinyarwanda risk-alert SMS to the highest-risk sectors via Africa's Talking, for CHWs using feature phones.",
  },
  {
    href: `${API_URL}/docs`,
    external: true,
    label: "Backend API",
    audience: "For developers",
    desc:
      "Interactive API documentation for the FastAPI backend serving predictions and alerts.",
  },
];

export default function Home() {
  const [api, setApi] = useState<ApiStatus | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { error: `HTTP ${r.status}` }))
      .then(setApi)
      .catch((e) =>
        setApi({ error: e instanceof Error ? e.message : "unreachable" })
      );
  }, []);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-6 py-16 sm:px-12 lg:px-24">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <p className="text-sm uppercase tracking-widest text-neutral-500 mb-4">
          Capstone &middot; BSc Software Engineering &middot; ALU
        </p>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-4">
          Kurinda
        </h1>
        <p className="text-lg text-neutral-300 mb-8 leading-relaxed max-w-3xl">
          A machine learning early-warning system that predicts village-level
          chronic childhood stunting risk in Rwanda, delivered through three
          channels for the people who act on it.
        </p>

        {/* Backend status pill */}
        <div className="inline-flex items-center gap-2 border border-neutral-800 rounded-full px-4 py-1.5 mb-12 text-sm font-mono">
          <span className="text-neutral-500">backend:</span>
          {api == null ? (
            <span className="text-neutral-400">checking…</span>
          ) : api.error ? (
            <span className="text-red-400">✗ {api.error}</span>
          ) : (
            <span className="text-emerald-400">● {api.status}</span>
          )}
        </div>

        {/* Channel cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {CHANNELS.map((c) => {
            const cardBody = (
              <div className="h-full border border-neutral-800 rounded-xl p-6 bg-neutral-900/40 hover:bg-neutral-900 hover:border-neutral-600 transition-colors">
                <p className="text-xs uppercase tracking-widest text-neutral-500 mb-2">
                  {c.audience}
                </p>
                <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
                  {c.label}
                  {c.external && (
                    <span className="text-neutral-500 text-sm">↗</span>
                  )}
                </h2>
                <p className="text-sm text-neutral-400 leading-relaxed">
                  {c.desc}
                </p>
              </div>
            );
            return c.external ? (
              <a
                key={c.href}
                href={c.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {cardBody}
              </a>
            ) : (
              <Link key={c.href} href={c.href}>
                {cardBody}
              </Link>
            );
          })}
        </div>

        {/* Footer */}
        <footer className="mt-16 text-sm text-neutral-500">
          <p>Thierry SHYAKA &middot; Supervisor: Dirac Murairi &middot; 2026</p>
        </footer>
      </div>
    </main>
  );
}

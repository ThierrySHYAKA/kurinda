/**
 * Kurinda - Registration page.
 *
 * Two steps on one page, no route change: (1) pick account type — District
 * Officer, CHW Supervisor, or CHW — then (2) name, email, password, and the
 * real district/sector for that role (dropdowns sourced from the backend's
 * actual 422-sector list, not free text, so it can never mismatch the data
 * the dashboards are scoped by).
 *
 * Registering logs the user in immediately and redirects to their role's
 * view, same as /login.
 */
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import {
  register,
  fetchDistricts,
  fetchSectorsForDistrict,
  ROLE_HOME,
  ROLE_LABEL,
  type UserRole,
} from "@/lib/auth";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";

const ROLE_CARDS: { role: UserRole; audience: string; desc: string }[] = [
  {
    role: "district_officer",
    audience: "For district nutrition officers",
    desc: "Strategic view of your district: risk map, priority sectors, intervention tracking, report export.",
  },
  {
    role: "chw_supervisor",
    audience: "For community health worker supervisors",
    desc: "Operational view of your district's sectors, plus a chatbot assistant grounded in Kurinda's data.",
  },
  {
    role: "chw",
    audience: "For rural community health workers",
    desc: "Kinyarwanda SMS risk alerts for your sector, no app required.",
  },
];

function isValidRole(value: string | null): value is UserRole {
  return value === "district_officer" || value === "chw_supervisor" || value === "chw";
}

const inputClass =
  "w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-slate-900 dark:text-slate-100 transition-colors focus:outline-none focus:border-cyan-500 disabled:opacity-50";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [role, setRole] = useState<UserRole | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [districts, setDistricts] = useState<string[]>([]);
  const [district, setDistrict] = useState("");
  const [sectors, setSectors] = useState<string[]>([]);
  const [sector, setSector] = useState("");
  const [sectorsLoading, setSectorsLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preselect the role from ?role=... (set when arriving via a home-page card).
  useEffect(() => {
    const preset = searchParams.get("role");
    if (isValidRole(preset)) setRole(preset);
  }, [searchParams]);

  // Load districts once, when step 2 first needs them.
  useEffect(() => {
    if (role && districts.length === 0) {
      fetchDistricts()
        .then(setDistricts)
        .catch(() => setError("Could not load district list"));
    }
  }, [role, districts.length]);

  // Load sectors whenever the chosen district changes (supervisor/chw only).
  useEffect(() => {
    if (!district || role === "district_officer") {
      setSectors([]);
      return;
    }
    setSectorsLoading(true);
    setSector("");
    fetchSectorsForDistrict(district)
      .then(setSectors)
      .catch(() => setError("Could not load sector list"))
      .finally(() => setSectorsLoading(false));
  }, [district, role]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!role) return;
    setLoading(true);
    setError(null);
    try {
      const user = await register({
        name,
        email,
        password,
        role,
        district: district || undefined,
        sector: role === "district_officer" ? undefined : sector || undefined,
      });
      router.push(ROLE_HOME[user.role]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 px-6 py-16 sm:px-12">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            ← Home
          </Link>
          <ThemeToggle />
        </div>

        <div className="mt-6 mb-1">
          <Logo />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mb-2 mt-4">
          Create an account
        </h1>
        <div className="flex items-center gap-2 mb-8">
          <span className="h-1.5 w-6 rounded-full bg-cyan-400" />
          <span
            className={`h-1.5 w-6 rounded-full transition-colors ${
              role ? "bg-cyan-400" : "bg-slate-200 dark:bg-slate-800"
            }`}
          />
          <p className="text-sm text-slate-500 ml-2">
            Step {role ? "2" : "1"} of 2 &middot;{" "}
            {role ? "your details" : "choose your account type"}
          </p>
        </div>

        {!role ? (
          <div className="space-y-3 animate-[fadeIn_0.15s_ease-out]">
            {ROLE_CARDS.map((c) => (
              <button
                key={c.role}
                type="button"
                onClick={() => setRole(c.role)}
                className="w-full text-left border border-slate-200 dark:border-slate-800 rounded-xl p-5 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
              >
                <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">
                  {c.audience}
                </p>
                <h2 className="text-lg font-semibold mb-1">{ROLE_LABEL[c.role]}</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{c.desc}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 bg-slate-50 dark:bg-slate-900/40 animate-[fadeIn_0.15s_ease-out]">
            <button
              type="button"
              onClick={() => setRole(null)}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors mb-4"
            >
              ← Change account type ({ROLE_LABEL[role]})
            </button>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-xs text-slate-500 mb-1">
                  Full name
                </label>
                <input
                  id="name"
                  required
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-xs text-slate-500 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-xs text-slate-500 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
                <p className="text-xs text-slate-600 mt-1">At least 8 characters.</p>
              </div>

              <div>
                <label htmlFor="district" className="block text-xs text-slate-500 mb-1">
                  District
                </label>
                <select
                  id="district"
                  required
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className={inputClass}
                >
                  <option value="" disabled>
                    {districts.length === 0 ? "Loading districts…" : "Select a district"}
                  </option>
                  {districts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {role !== "district_officer" && (
                <div>
                  <label htmlFor="sector" className="block text-xs text-slate-500 mb-1">
                    Sector
                  </label>
                  <select
                    id="sector"
                    required
                    disabled={!district || sectorsLoading}
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    className={inputClass}
                  >
                    <option value="" disabled>
                      {!district
                        ? "Choose a district first"
                        : sectorsLoading
                        ? "Loading sectors…"
                        : "Select a sector"}
                    </option>
                    {sectors.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {error && (
                <div className="border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 rounded-lg p-3 text-sm text-red-700 dark:text-red-300 animate-[fadeIn_0.15s_ease-out]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 rounded px-5 py-2 text-sm font-semibold transition-colors"
              >
                {loading && (
                  <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-slate-950/40 border-t-slate-950 animate-spin" />
                )}
                {loading ? "Creating account…" : "Create account"}
              </button>
            </form>
          </div>
        )}

        <p className="text-sm text-slate-500 mt-6 text-center">
          Already have an account?{" "}
          <Link href="/login" className="text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white underline transition-colors">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}

/**
 * Kurinda - Login page.
 *
 * Authenticates against the backend and redirects each role to its own
 * view: District Officer -> /dashboard, CHW Supervisor -> /chw, CHW -> /alerts.
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { login, ROLE_HOME } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await login(email, password);
      router.push(ROLE_HOME[user.role]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-6 py-16 sm:px-12">
      <div className="max-w-sm mx-auto">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-300">
          ← Home
        </Link>

        <p className="text-xs uppercase tracking-widest text-neutral-500 mt-6 mb-1">
          Kurinda
        </p>
        <h1 className="text-2xl font-semibold tracking-tight mb-6">Log in</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs text-neutral-500 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-neutral-100 focus:outline-none focus:border-neutral-500"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-xs text-neutral-500 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-neutral-100 focus:outline-none focus:border-neutral-500"
            />
          </div>

          {error && (
            <div className="border border-red-900 bg-red-950/40 rounded-lg p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded px-5 py-2 text-sm font-medium"
          >
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="text-sm text-neutral-500 mt-6">
          No account?{" "}
          <Link href="/register" className="text-neutral-300 hover:text-white underline">
            Register
          </Link>
        </p>
      </div>
    </main>
  );
}

/**
 * Kurinda - Registration page.
 *
 * Self-signup: the user picks their own role (District Officer / CHW
 * Supervisor / CHW). No admin step. Registering logs the user in immediately
 * and redirects to their role's view, same as /login.
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { register, ROLE_HOME, ROLE_LABEL, type UserRole } from "@/lib/auth";

const ROLES: UserRole[] = ["district_officer", "chw_supervisor", "chw"];

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("district_officer");
  const [district, setDistrict] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await register({
        name,
        email,
        password,
        role,
        district: district.trim() || undefined,
      });
      router.push(ROLE_HOME[user.role]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
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
        <h1 className="text-2xl font-semibold tracking-tight mb-6">
          Create an account
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-xs text-neutral-500 mb-1">
              Full name
            </label>
            <input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-neutral-100 focus:outline-none focus:border-neutral-500"
            />
          </div>
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
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-neutral-100 focus:outline-none focus:border-neutral-500"
            />
            <p className="text-xs text-neutral-600 mt-1">At least 8 characters.</p>
          </div>
          <div>
            <label htmlFor="role" className="block text-xs text-neutral-500 mb-1">
              Role
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-neutral-100 focus:outline-none focus:border-neutral-500"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="district" className="block text-xs text-neutral-500 mb-1">
              District <span className="text-neutral-600">(optional)</span>
            </label>
            <input
              id="district"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
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
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-sm text-neutral-500 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-neutral-300 hover:text-white underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}

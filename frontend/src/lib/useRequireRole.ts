"use client";

/**
 * Kurinda - role-gated route guard.
 *
 * Each of /dashboard, /chw, /alerts is for exactly one role. This hook
 * redirects to /login if nobody's signed in, or to the visitor's own
 * ROLE_HOME if they're signed in as the wrong role — so a CHW Supervisor
 * can never land on the District Officer map, and vice versa.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser, ROLE_HOME, type AuthUser, type UserRole } from "@/lib/auth";

interface RoleGuard {
  user: AuthUser | null;
  ready: boolean;
}

export function useRequireRole(allowed: UserRole[]): RoleGuard {
  const router = useRouter();
  const [state, setState] = useState<RoleGuard>({ user: null, ready: false });

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) {
      router.replace("/login");
      return;
    }
    if (!allowed.includes(stored.role)) {
      router.replace(ROLE_HOME[stored.role]);
      return;
    }
    setState({ user: stored, ready: true });
    // `allowed` is expected to be a stable module-level constant
    // (OFFICER_ONLY / SUPERVISOR_ONLY / CHW_ONLY from lib/auth).
  }, [router, allowed]);

  return state;
}

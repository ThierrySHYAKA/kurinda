/**
 * Kurinda - auth client.
 *
 * Talks to the backend's /auth endpoints and persists the access token +
 * user in localStorage. The backend issues a JWT; we send it back as a
 * Bearer token on requests that need it (e.g. /auth/me).
 */

export type UserRole = "district_officer" | "chw_supervisor" | "chw";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  district?: string | null;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://kurinda-backend.onrender.com";

const TOKEN_KEY = "kurinda_token";
const USER_KEY = "kurinda_user";

// Where each role lands after logging in.
export const ROLE_HOME: Record<UserRole, string> = {
  district_officer: "/dashboard",
  chw_supervisor: "/chw",
  chw: "/alerts",
};

export const ROLE_LABEL: Record<UserRole, string> = {
  district_officer: "District Officer",
  chw_supervisor: "CHW Supervisor",
  chw: "Community Health Worker",
};

async function parseResponse(res: Response): Promise<TokenResponse> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.detail ?? `HTTP ${res.status}`);
  }
  return data as TokenResponse;
}

function persist(data: TokenResponse) {
  localStorage.setItem(TOKEN_KEY, data.access_token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
}

export async function register(input: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  district?: string;
}): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseResponse(res);
  persist(data);
  return data.user;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await parseResponse(res);
  persist(data);
  return data.user;
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

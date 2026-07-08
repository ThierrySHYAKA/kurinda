/**
 * Kurinda - interventions client.
 *
 * District Officers log interventions, CHW Supervisors mark visits
 * complete — same underlying record (backend/models.py: Intervention),
 * framed differently per role in the UI. Both require a logged-in user;
 * requests go through authFetch so the Bearer token is attached.
 */
import { authFetch } from "./auth";

export interface Intervention {
  id: number;
  sector: string;
  district: string;
  note: string | null;
  logged_by_name: string;
  logged_by_role: string;
  created_at: string;
}

export async function fetchInterventions(params: {
  district?: string;
  sector?: string;
}): Promise<Intervention[]> {
  const query = new URLSearchParams();
  if (params.district) query.set("district", params.district);
  if (params.sector) query.set("sector", params.sector);
  const res = await authFetch(`/interventions?${query.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function logIntervention(
  sector: string,
  note?: string
): Promise<Intervention> {
  const res = await authFetch("/interventions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sector, note: note || undefined }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.detail ?? `HTTP ${res.status}`);
  return data as Intervention;
}

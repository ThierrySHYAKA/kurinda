/**
 * Kurinda - Home Page
 *
 * Machine learning early-warning system for predicting village-level
 * chronic childhood stunting risk in Rwanda.
 *
 * This page is a server component that fetches a health-check from the
 * Kurinda backend API to demonstrate that frontend and backend are live
 * and integrated.
 */

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://kurinda-backend.onrender.com";

async function getApiStatus(): Promise<{
  service?: string;
  version?: string;
  status?: string;
  error?: string;
}> {
  try {
    const res = await fetch(`${API_URL}/`, { cache: "no-store" });
    if (!res.ok) {
      return { error: `HTTP ${res.status}` };
    }
    return await res.json();
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Unknown fetch error",
    };
  }
}

export default async function Home() {
  const api = await getApiStatus();

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-6 py-16 sm:px-12 lg:px-24">
      <div className="max-w-3xl mx-auto">
        <p className="text-sm uppercase tracking-widest text-neutral-500 mb-4">
          Capstone · BSc Software Engineering · ALU
        </p>

        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-6">
          Kurinda
        </h1>

        <p className="text-xl text-neutral-300 mb-8 leading-relaxed">
          A machine learning early-warning system for predicting village-level
          chronic childhood stunting risk in Rwanda using multi-source data
          fusion.
        </p>

        <div className="border border-neutral-800 rounded-lg p-6 bg-neutral-900/50">
          <p className="text-sm font-medium text-neutral-400 mb-3">
            Backend API status
          </p>

          {api.error ? (
            <p className="text-red-400 font-mono text-sm">
              ✗ Could not reach API: {api.error}
            </p>
          ) : (
            <div className="space-y-1 font-mono text-sm">
              <p>
                <span className="text-neutral-500">service:</span>{" "}
                <span className="text-emerald-400">{api.service}</span>
              </p>
              <p>
                <span className="text-neutral-500">version:</span>{" "}
                <span className="text-neutral-200">{api.version}</span>
              </p>
              <p>
                <span className="text-neutral-500">status:</span>{" "}
                <span className="text-emerald-400">● {api.status}</span>
              </p>
            </div>
          )}

          <p className="text-xs text-neutral-600 mt-4 font-mono">
            {API_URL}
          </p>
        </div>

        <footer className="mt-16 text-sm text-neutral-500">
          <p>Thierry SHYAKA · Supervisor: Dirac Murairi · 2026</p>
        </footer>
      </div>
    </main>
  );
}
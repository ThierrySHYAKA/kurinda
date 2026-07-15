/**
 * Kurinda - small inline loading spinner, used instead of plain "Loading…"
 * text on the role-gated pages while the auth guard resolves.
 */
export default function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-slate-500">
      <span
        className="inline-block h-4 w-4 rounded-full border-2 border-slate-300 dark:border-slate-700 border-t-cyan-500 dark:border-t-cyan-400 animate-spin"
        aria-hidden
      />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

/**
 * Kurinda - small inline loading spinner, used instead of plain "Loading…"
 * text on the role-gated pages while the auth guard resolves.
 */
export default function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-neutral-500">
      <span
        className="inline-block h-4 w-4 rounded-full border-2 border-neutral-700 border-t-emerald-500 animate-spin"
        aria-hidden
      />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

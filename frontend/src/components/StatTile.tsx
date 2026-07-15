/**
 * Kurinda - a single labelled stat, used in small grids on the home page
 * and dashboard (sector counts, risk counts, etc). "red"/"emerald" are risk
 * semantics (high-risk / low-risk counts) - kept independent of the brand
 * accent colour, which lives in buttons/links instead.
 */
interface StatTileProps {
  label: string;
  value: React.ReactNode;
  accent?: "default" | "red" | "emerald" | "cyan";
}

const ACCENT_CLASS: Record<NonNullable<StatTileProps["accent"]>, string> = {
  default: "text-slate-900 dark:text-slate-100",
  red: "text-red-600 dark:text-red-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  cyan: "text-cyan-600 dark:text-cyan-400",
};

export default function StatTile({ label, value, accent = "default" }: StatTileProps) {
  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-3 bg-slate-50 dark:bg-slate-900/30">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-xl font-mono font-semibold ${ACCENT_CLASS[accent]}`}>
        {value}
      </p>
    </div>
  );
}

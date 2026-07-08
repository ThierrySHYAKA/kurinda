/**
 * Kurinda - a single labelled stat, used in small grids on the home page
 * and dashboard (sector counts, risk counts, etc).
 */
interface StatTileProps {
  label: string;
  value: React.ReactNode;
  accent?: "default" | "red" | "emerald";
}

const ACCENT_CLASS: Record<NonNullable<StatTileProps["accent"]>, string> = {
  default: "text-neutral-100",
  red: "text-red-400",
  emerald: "text-emerald-400",
};

export default function StatTile({ label, value, accent = "default" }: StatTileProps) {
  return (
    <div className="border border-neutral-800 rounded-lg px-4 py-3 bg-neutral-900/30">
      <p className="text-xs text-neutral-500 mb-1">{label}</p>
      <p className={`text-xl font-mono font-semibold ${ACCENT_CLASS[accent]}`}>
        {value}
      </p>
    </div>
  );
}

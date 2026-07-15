/**
 * Kurinda - risk tier badge.
 *
 * Maps a 0-1 risk value to the same 5 bands already used by the map's
 * colour legend (50%+ / 40-50 / 30-40 / 20-30 / under 20), as a scannable
 * word label to sit next to the raw percentage - not a new scale, just a
 * label for the one that already exists.
 */
export type RiskTier = "critical" | "high" | "elevated" | "moderate" | "low" | "unknown";

export const TIER_LABEL: Record<RiskTier, string> = {
  critical: "Critical",
  high: "High",
  elevated: "Elevated",
  moderate: "Moderate",
  low: "Low",
  unknown: "No data",
};

const TIER_CLASS: Record<RiskTier, string> = {
  critical: "text-red-700 border-red-300 bg-red-100 dark:text-red-300 dark:border-red-800 dark:bg-red-950/50",
  high: "text-red-700 border-red-300 bg-red-50 dark:text-red-300 dark:border-red-900 dark:bg-red-950/30",
  elevated: "text-orange-700 border-orange-300 bg-orange-50 dark:text-orange-300 dark:border-orange-900 dark:bg-orange-950/30",
  moderate: "text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-300 dark:border-amber-900 dark:bg-amber-950/30",
  low: "text-yellow-700 border-yellow-300 bg-yellow-50 dark:text-yellow-200 dark:border-yellow-900/60 dark:bg-yellow-950/20",
  unknown: "text-slate-600 border-slate-300 bg-slate-100 dark:text-slate-400 dark:border-slate-700 dark:bg-slate-900",
};

export function riskTier(value: number | null | undefined): RiskTier {
  if (value == null || Number.isNaN(value)) return "unknown";
  if (value >= 0.5) return "critical";
  if (value >= 0.4) return "high";
  if (value >= 0.3) return "elevated";
  if (value >= 0.2) return "moderate";
  return "low";
}

export default function RiskBadge({
  value,
  className = "",
}: {
  value: number | null | undefined;
  className?: string;
}) {
  const tier = riskTier(value);
  return (
    <span
      className={`text-xs font-medium border rounded-full px-2 py-0.5 whitespace-nowrap ${TIER_CLASS[tier]} ${className}`}
    >
      {TIER_LABEL[tier]}
    </span>
  );
}

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
  critical: "text-red-300 border-red-800 bg-red-950/50",
  high: "text-red-300 border-red-900 bg-red-950/30",
  elevated: "text-orange-300 border-orange-900 bg-orange-950/30",
  moderate: "text-amber-300 border-amber-900 bg-amber-950/30",
  low: "text-yellow-200 border-yellow-900/60 bg-yellow-950/20",
  unknown: "text-neutral-400 border-neutral-700 bg-neutral-900",
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

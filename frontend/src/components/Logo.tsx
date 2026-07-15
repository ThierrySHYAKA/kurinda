/**
 * Kurinda - wordmark lockup (K badge + name), used in the home page hero
 * and the shared dashboard header.
 */
export default function Logo({ withName = true }: { withName?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded bg-cyan-400 text-sm font-bold text-slate-950">
        K
      </span>
      {withName && (
        <span className="text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-100">
          KURINDA
        </span>
      )}
    </div>
  );
}

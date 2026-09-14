"use client";

import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";
import { formatCompactNumber } from "@/lib/format";

interface StatsCounterProps {
  label: string;
  /** The measured figure, or null while the feed has not produced one. */
  value: number | null;
  prefix?: string;
  /** Shown under the figure - where it came from, in the visitor's words. */
  note?: string;
}

export function StatsCounter({ label, value, prefix = "", note }: StatsCounterProps) {
  const animated = useAnimatedCounter(value ?? 0);

  return (
    <div>
      <div className="font-mono text-xs uppercase tracking-wide text-white/40">{label}</div>
      <div className="mt-2 font-mono text-3xl font-semibold tabular-nums text-white sm:text-4xl">
        {/* A dash rather than a zero or a plausible-looking placeholder: an
            unreachable feed should read as "we don't know", not as a number. */}
        {value === null ? (
          <span className="text-white/25">&mdash;</span>
        ) : (
          <>
            {prefix}
            {formatCompactNumber(animated)}
          </>
        )}
      </div>
      {note && <div className="mt-1.5 text-xs text-white/35">{note}</div>}
    </div>
  );
}

"use client";

import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";
import { formatCompactNumber } from "@/lib/format";

interface StatsCounterProps {
  label: string;
  seed: number;
  prefix?: string;
  nudgeMax?: number;
}

export function StatsCounter({ label, seed, prefix = "", nudgeMax = 0 }: StatsCounterProps) {
  const value = useAnimatedCounter(seed, {
    nudgeMax,
    nudgeMin: 0,
    nudgeIntervalMs: 2500,
  });

  return (
    <div className="text-center">
      <div className="font-mono text-3xl font-bold text-white sm:text-4xl">
        {prefix}
        {formatCompactNumber(value)}
      </div>
      <div className="mt-2 text-sm text-white/50">{label}</div>
    </div>
  );
}

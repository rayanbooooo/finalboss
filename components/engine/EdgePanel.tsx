"use client";

import { clsx } from "clsx";
import type { GatedSetup } from "@/hooks/useMnqEngine";
import type { SetupStats } from "@/lib/mnq/setups";

interface EdgePanelProps {
  stats: SetupStats;
  setups: GatedSetup[];
  /** False when the bars are synthetic, which changes what these numbers mean. */
  isLive: boolean;
}

/**
 * Realised performance of the setups currently on the chart.
 *
 * Carries a warning rather than a disclaimer buried elsewhere: on simulated
 * bars these numbers measure the simulator, not the strategy. The generator
 * writes mean-reverting stop runs into the data and the scanner is built to
 * find exactly those, so a positive expectancy here is close to circular. Only
 * the Databento path, or the Nautilus harness in research/, says anything
 * about a real edge.
 */
export function EdgePanel({ stats, setups, isLive }: EdgePanelProps) {
  const byPattern = new Map<string, { n: number; r: number }>();
  for (const setup of setups) {
    if (setup.realisedR === null) continue;
    const entry = byPattern.get(setup.pattern) ?? { n: 0, r: 0 };
    entry.n += 1;
    entry.r += setup.realisedR;
    byPattern.set(setup.pattern, entry);
  }

  const blocked = setups.filter((s) => !s.gate.allowed).length;

  return (
    <section className="glass-panel p-4">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-sm tracking-wide text-white/80">Edge</h2>
        <span className="font-mono text-[10px] uppercase tracking-wider text-white/35">
          {stats.resolved}/{stats.total} resolved
        </span>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Win rate" value={`${(stats.winRate * 100).toFixed(1)}%`} />
        <Stat
          label="Avg R"
          value={stats.averageR >= 0 ? `+${stats.averageR.toFixed(2)}` : stats.averageR.toFixed(2)}
          tone={stats.averageR > 0 ? "text-emerald-400" : stats.averageR < 0 ? "text-rose-400" : undefined}
        />
        <Stat
          label="Total R"
          value={stats.expectancyR >= 0 ? `+${stats.expectancyR.toFixed(1)}` : stats.expectancyR.toFixed(1)}
          tone={stats.expectancyR > 0 ? "text-emerald-400" : stats.expectancyR < 0 ? "text-rose-400" : undefined}
        />
      </div>

      {byPattern.size > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-white/8 pt-3">
          {[...byPattern.entries()]
            .sort((a, b) => b[1].r - a[1].r)
            .map(([pattern, entry]) => (
              <li key={pattern} className="flex items-center gap-2 text-[11px]">
                <span className="flex-1 truncate text-white/55">{pattern}</span>
                <span className="font-mono text-[10px] text-white/30">n={entry.n}</span>
                <span
                  className={clsx(
                    "w-12 text-right font-mono text-[11px]",
                    entry.r > 0 ? "text-emerald-400" : entry.r < 0 ? "text-rose-400" : "text-white/40",
                  )}
                >
                  {entry.r >= 0 ? "+" : ""}
                  {entry.r.toFixed(1)}R
                </span>
              </li>
            ))}
        </ul>
      )}

      <p className="mt-3 border-t border-white/8 pt-3 text-[10px] leading-relaxed text-white/35">
        {blocked > 0 && (
          <>
            <span className="text-amber-300/80">{blocked}</span> of {setups.length} setups blocked by account rules.{" "}
          </>
        )}
        {isLive ? (
          <>Resolved on real bars. Same-bar stop and target resolves as a loss.</>
        ) : (
          <span className="text-amber-300/80">
            Synthetic bars — this measures the simulator, not an edge. Connect Databento or run the Nautilus harness.
          </span>
        )}
      </p>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className={clsx("font-mono text-base font-medium", tone ?? "text-white/90")}>{value}</div>
    </div>
  );
}

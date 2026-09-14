"use client";

import { clsx } from "clsx";
import type { AccountAssessment, PropRules } from "@/lib/mnq/propRules";
import { formatCurrency } from "@/lib/format";

interface RiskRailProps {
  assessment: AccountAssessment;
  rules: PropRules;
}

/**
 * Distance to the drawdown floor, rendered as prominently as price.
 *
 * This is the number that decides whether an evaluation survives, and it is
 * the number every other trading UI buries. Under intraday trailing it moves
 * up with unrealised profit and never comes back down, so "my balance is fine"
 * and "my account is fine" are different statements.
 */
export function RiskRail({ assessment, rules }: RiskRailProps) {
  const { equity, floor, roomUsd, roomFraction, roomPoints, dailyRoomUsd, toTargetUsd, breached, warnings } = assessment;

  const tone = breached
    ? { bar: "bg-rose-500", text: "text-rose-400", glow: "shadow-glow-rose" }
    : roomFraction < 0.25
      ? { bar: "bg-rose-400", text: "text-rose-400", glow: "shadow-glow-rose" }
      : roomFraction < 0.5
        ? { bar: "bg-amber-400", text: "text-amber-400", glow: "" }
        : { bar: "bg-emerald-400", text: "text-emerald-400", glow: "shadow-glow-emerald" };

  return (
    <section className="glass-panel p-4">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-sm tracking-wide text-white/80">Account risk</h2>
        <span className="font-mono text-[11px] text-white/40">{rules.label}</span>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Metric label="Equity" value={formatCurrency(equity)} />
        <Metric label="Floor" value={formatCurrency(floor)} tone="text-rose-400/90" />
      </div>

      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-wider text-white/40">Room to floor</span>
        <span className={clsx("font-mono text-sm font-medium", tone.text)}>
          {formatCurrency(roomUsd)}
          <span className="ml-1.5 text-[11px] text-white/35">{roomPoints.toFixed(1)} pt</span>
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-white/8">
        <div
          className={clsx("h-full rounded-full transition-[width] duration-500", tone.bar, tone.glow)}
          style={{ width: `${Math.max(0, Math.min(100, roomFraction * 100))}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Metric
          label="Daily room"
          value={dailyRoomUsd === null ? "No limit" : formatCurrency(dailyRoomUsd)}
          tone={dailyRoomUsd !== null && dailyRoomUsd <= 0 ? "text-rose-400" : undefined}
        />
        <Metric
          label="To target"
          value={toTargetUsd === null ? "Funded" : formatCurrency(toTargetUsd)}
          tone={toTargetUsd === 0 ? "text-emerald-400" : undefined}
        />
      </div>

      {warnings.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-white/8 pt-3">
          {warnings.map((warning) => (
            <li key={warning} className="flex gap-2 text-[11px] leading-relaxed text-amber-300/90">
              <span aria-hidden className="mt-0.5 text-amber-400">
                ▲
              </span>
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-white/40">{label}</div>
      <div className={clsx("font-mono text-sm font-medium", tone ?? "text-white/90")}>{value}</div>
    </div>
  );
}

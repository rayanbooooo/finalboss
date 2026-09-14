"use client";

import { clsx } from "clsx";
import type { GatedSetup } from "@/hooks/useMnqEngine";
import { ConfluenceMeter, ScoreRing } from "@/components/engine/ConfluenceMeter";
import { formatMnqPrice, formatPoints, pointsToUsd } from "@/lib/mnq/contract";
import { formatCurrency } from "@/lib/format";
import { formatEtClock } from "@/lib/mnq/sessions";

interface SetupFeedProps {
  setups: GatedSetup[];
  selectedId: string | null;
  onSelect: (setup: GatedSetup) => void;
}

const PATTERN_LABEL: Record<string, string> = {
  "sweep-reversal": "Sweep reversal",
  "fvg-continuation": "FVG continuation",
  "ob-retest": "OB retest",
};

const STATUS_STYLE: Record<string, string> = {
  pending: "border-white/15 bg-white/5 text-white/50",
  triggered: "border-violet-400/40 bg-violet-500/15 text-violet-200",
  target: "border-emerald-400/40 bg-emerald-500/15 text-emerald-300",
  stopped: "border-rose-400/40 bg-rose-500/15 text-rose-300",
  invalidated: "border-white/10 bg-white/3 text-white/30",
};

export function SetupFeed({ setups, selectedId, onSelect }: SetupFeedProps) {
  if (setups.length === 0) {
    return (
      <div className="glass-panel flex h-full items-center justify-center p-8 text-center">
        <p className="max-w-[28ch] text-sm text-white/40">
          No setups meet the current score and R:R thresholds. Loosen them in Scanner, or wait for a killzone.
        </p>
      </div>
    );
  }

  return (
    <ul className="scrollbar-thin h-full space-y-2 overflow-y-auto pr-1">
      {setups.map((setup) => {
        const selected = setup.id === selectedId;
        const blocked = !setup.gate.allowed;

        return (
          <li key={setup.id}>
            <button
              type="button"
              onClick={() => onSelect(setup)}
              className={clsx(
                "w-full rounded-xl border p-3 text-left transition-colors",
                selected
                  ? "border-violet-400/50 bg-violet-500/10"
                  : "border-white/8 bg-white/3 hover:border-white/20 hover:bg-white/5",
              )}
            >
              <div className="flex items-start gap-3">
                <ScoreRing score={setup.score} />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={clsx(
                        "font-mono text-[11px] font-semibold uppercase tracking-wider",
                        setup.direction === "bullish" ? "text-emerald-400" : "text-rose-400",
                      )}
                    >
                      {setup.direction === "bullish" ? "▲ Long" : "▼ Short"}
                    </span>
                    <span className="truncate text-[11px] text-white/55">
                      {PATTERN_LABEL[setup.pattern] ?? setup.pattern}
                    </span>
                    <span
                      className={clsx(
                        "ml-auto shrink-0 rounded-full border px-1.5 py-0.5 font-mono text-[9px] uppercase",
                        STATUS_STYLE[setup.status],
                      )}
                    >
                      {setup.status}
                    </span>
                  </div>

                  <div className="mt-1.5 grid grid-cols-3 gap-2 font-mono text-[11px]">
                    <Level label="Entry" value={formatMnqPrice(setup.entry)} tone="text-violet-300" />
                    <Level label="Stop" value={formatMnqPrice(setup.stop)} tone="text-rose-300" />
                    <Level label="Target" value={formatMnqPrice(setup.target)} tone="text-emerald-300" />
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-white/40">
                    <span>{setup.rr.toFixed(2)}R</span>
                    <span>{formatPoints(setup.stopPoints)} stop</span>
                    <span>{formatEtClock(setup.time)} ET</span>
                    {setup.gate.allowed ? (
                      <span className="text-emerald-400/90">
                        {setup.gate.contracts} lot{setup.gate.contracts === 1 ? "" : "s"} ·{" "}
                        {formatCurrency(pointsToUsd(setup.stopPoints, setup.gate.contracts))} risk
                      </span>
                    ) : (
                      <span className="text-rose-400/90">Blocked</span>
                    )}
                  </div>
                </div>
              </div>

              {selected && (
                <div className="mt-3 space-y-3 border-t border-white/8 pt-3">
                  <p className="text-[11px] leading-relaxed text-white/55">{setup.narrative}</p>
                  <ConfluenceMeter confluences={setup.confluences} />
                  {blocked && setup.gate.reasons.length > 0 && (
                    <ul className="space-y-1 rounded-lg border border-rose-400/25 bg-rose-500/8 p-2">
                      {setup.gate.reasons.map((reason) => (
                        <li key={reason} className="text-[10px] leading-relaxed text-rose-300/90">
                          {reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Level({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-white/30">{label}</div>
      <div className={tone}>{value}</div>
    </div>
  );
}

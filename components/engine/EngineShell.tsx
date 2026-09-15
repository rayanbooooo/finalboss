"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { useMnqEngine, type GatedSetup } from "@/hooks/useMnqEngine";
import { useMnqForecast } from "@/hooks/useMnqForecast";
import { SetupChart } from "@/components/engine/SetupChart";
import { SetupFeed } from "@/components/engine/SetupFeed";
import { RiskRail } from "@/components/engine/RiskRail";
import { SessionRail } from "@/components/engine/SessionRail";
import { EdgePanel } from "@/components/engine/EdgePanel";
import { RulesPanel } from "@/components/engine/RulesPanel";
import { ForecastPanel } from "@/components/engine/ForecastPanel";
import { formatMnqPrice, MNQ } from "@/lib/mnq/contract";

const INTERVALS: { label: string; ms: number }[] = [
  { label: "1m", ms: 60_000 },
  { label: "5m", ms: 300_000 },
  { label: "15m", ms: 900_000 },
  { label: "1h", ms: 3_600_000 },
];

export function EngineShell() {
  const engine = useMnqEngine();
  const { forecast, isLoading: forecastLoading } = useMnqForecast(engine.bars?.candles);
  const [pickedId, setPickedId] = useState<string | null>(null);

  /*
   * Selection is derived, not stored-and-synced.
   *
   * The obvious version — an effect that setStates the default selection when
   * the setup list changes — costs a second render pass on every refetch and
   * fights the user's own choice on the frame the list updates. Falling back to
   * the newest setup only when the picked one is gone gets the same behaviour
   * with no effect at all.
   */
  const selected = useMemo<GatedSetup | null>(() => {
    const picked = engine.setups.find((setup) => setup.id === pickedId);
    return picked ?? engine.setups[0] ?? null;
  }, [engine.setups, pickedId]);

  const selectedId = selected?.id ?? null;

  const candles = engine.bars?.candles ?? [];
  const priorClose = candles.length > 1 ? candles[candles.length - 2].close : null;
  const change = engine.lastPrice !== null && priorClose !== null ? engine.lastPrice - priorClose : null;

  return (
    <div className="flex min-h-screen flex-col gap-3 bg-base-950 p-3 lg:h-screen lg:overflow-hidden">
      <header className="glass-panel flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
        <div className="flex items-baseline gap-2.5">
          <h1 className="font-display text-lg tracking-tight text-white">{MNQ.symbol}</h1>
          <span className="hidden text-[11px] text-white/35 sm:inline">{MNQ.name}</span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="font-mono text-xl tabular-nums text-white">
            {engine.lastPrice === null ? "—" : formatMnqPrice(engine.lastPrice)}
          </span>
          {change !== null && (
            <span className={clsx("font-mono text-xs", change >= 0 ? "text-emerald-400" : "text-rose-400")}>
              {change >= 0 ? "+" : ""}
              {change.toFixed(2)}
            </span>
          )}
        </div>

        {/* Three states, not two. Yahoo is real price data but delayed and
            unofficial, so badging it the same green as a paid exchange feed
            would overstate it — and the same amber as invented prices would
            understate it just as badly. */}
        <span
          className={clsx(
            "rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider",
            engine.bars?.source === "databento"
              ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
              : engine.bars?.source === "yahoo"
                ? "border-sky-400/40 bg-sky-500/15 text-sky-300"
                : "border-amber-400/40 bg-amber-500/15 text-amber-300",
          )}
          title={engine.bars?.note}
        >
          {engine.bars?.source === "databento"
            ? "Live · Databento"
            : engine.bars?.source === "yahoo"
              ? "Real · delayed"
              : "Simulated"}
        </span>

        <div className="ml-auto flex items-center gap-1">
          {INTERVALS.map((interval) => (
            <button
              key={interval.ms}
              type="button"
              onClick={() => engine.setIntervalMs(interval.ms)}
              className={clsx(
                "rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors",
                interval.ms === engine.intervalMs
                  ? "bg-violet-500/20 text-violet-200"
                  : "text-white/40 hover:bg-white/5 hover:text-white/70",
              )}
            >
              {interval.label}
            </button>
          ))}
        </div>
      </header>

      <SessionRail />

      <div className="grid min-h-0 min-w-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <div className="glass-panel min-h-[340px] min-w-0 flex-1 overflow-hidden p-1">
            {engine.isError ? (
              <div className="flex h-full items-center justify-center text-sm text-rose-400/80">
                Could not load bars.
              </div>
            ) : (
              <SetupChart
                candles={candles}
                scan={engine.scan}
                selected={selected}
                onSelect={(setup) => setPickedId(setup.id)}
              />
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <RiskRail assessment={engine.assessment} rules={engine.rules} />
            <EdgePanel stats={engine.stats} setups={engine.setups} isLive={Boolean(engine.bars?.isLive)} />
            <ForecastPanel forecast={forecast} isLoading={forecastLoading} lastPrice={engine.lastPrice} />
          </div>
        </div>

        <aside className="scrollbar-thin flex min-h-0 min-w-0 flex-col gap-3 lg:overflow-y-auto">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="font-display text-sm tracking-wide text-white/80">Setups</h2>
            <span className="font-mono text-[10px] uppercase tracking-wider text-white/35">
              {engine.setups.filter((s) => s.gate.allowed).length} tradeable / {engine.setups.length}
            </span>
          </div>

          <div className="min-h-[320px] flex-1">
            {engine.isLoading ? (
              <div className="glass-panel h-full animate-pulse" />
            ) : (
              <SetupFeed
                setups={engine.setups}
                selectedId={selectedId}
                onSelect={(setup) => setPickedId(setup.id)}
              />
            )}
          </div>

          <RulesPanel
            rules={engine.rules}
            onRulesChange={engine.setRules}
            options={engine.options}
            onOptionsChange={engine.setOptions}
            onReset={engine.resetAccount}
          />
        </aside>
      </div>
    </div>
  );
}

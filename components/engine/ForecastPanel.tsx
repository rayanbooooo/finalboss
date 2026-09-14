"use client";

import { clsx } from "clsx";
import type { ForecastResponse } from "@/lib/mnq/forecast";
import { forecastBias } from "@/lib/mnq/forecast";
import { formatMnqPrice } from "@/lib/mnq/contract";

interface ForecastPanelProps {
  forecast: ForecastResponse | null;
  isLoading: boolean;
  lastPrice: number | null;
}

/**
 * Kronos forecast overlay.
 *
 * Absent is a first-class state, not an error: most installs will not have a
 * GPU sidecar running, and the panel says how to enable one rather than
 * showing a broken widget. The bias readout is banded so a 52% probability
 * renders as "no edge" instead of a directional call.
 */
export function ForecastPanel({ forecast, isLoading, lastPrice }: ForecastPanelProps) {
  if (isLoading) {
    return (
      <section className="glass-panel p-4">
        <h2 className="mb-3 font-display text-sm tracking-wide text-white/80">Kronos forecast</h2>
        <div className="h-16 animate-pulse rounded-lg bg-white/5" />
      </section>
    );
  }

  if (!forecast || !forecast.available) {
    return (
      <section className="glass-panel p-4">
        <header className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-sm tracking-wide text-white/80">Kronos forecast</h2>
          <span className="rounded-full border border-white/12 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/35">
            Offline
          </span>
        </header>
        <p className="text-[11px] leading-relaxed text-white/40">
          {forecast?.note ?? "No sidecar configured."}
        </p>
        <p className="mt-2 font-mono text-[10px] leading-relaxed text-white/30">
          Run <span className="text-violet-300/80">services/kronos</span>, then set{" "}
          <span className="text-violet-300/80">KRONOS_SERVICE_URL</span>. Setup detection is unaffected.
        </p>
      </section>
    );
  }

  const bias = forecastBias(forecast);
  const biasStyle =
    bias === "bullish"
      ? { label: "Bullish", text: "text-emerald-400", bar: "bg-emerald-400" }
      : bias === "bearish"
        ? { label: "Bearish", text: "text-rose-400", bar: "bg-rose-400" }
        : { label: "No edge", text: "text-white/45", bar: "bg-white/25" };

  const finalMedian = forecast.median.at(-1) ?? null;
  const drift = finalMedian !== null && lastPrice !== null ? finalMedian - lastPrice : null;

  return (
    <section className="glass-panel p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-sm tracking-wide text-white/80">Kronos forecast</h2>
        <span className="font-mono text-[9px] uppercase tracking-wider text-white/35">
          {forecast.model.split("/").pop()} · {forecast.horizon}b
        </span>
      </header>

      <div className="mb-3 flex items-baseline gap-3">
        <span className={clsx("font-display text-xl", biasStyle.text)}>{biasStyle.label}</span>
        <span className="font-mono text-xs text-white/45">{(forecast.probUp * 100).toFixed(0)}% up</span>
        {drift !== null && (
          <span className={clsx("ml-auto font-mono text-xs", drift > 0 ? "text-emerald-400/80" : "text-rose-400/80")}>
            {drift > 0 ? "+" : ""}
            {drift.toFixed(2)} pt
          </span>
        )}
      </div>

      {/* Probability bar, centred on 50% with the dead band marked. */}
      <div className="relative mb-3 h-1.5 overflow-hidden rounded-full bg-white/8">
        <div className="absolute inset-y-0 left-[45%] w-[10%] bg-white/10" />
        <div
          className={clsx("absolute inset-y-0 w-0.5", biasStyle.bar)}
          style={{ left: `${Math.max(0, Math.min(100, forecast.probUp * 100))}%` }}
        />
      </div>

      <ForecastSpark median={forecast.median} upper={forecast.upper} lower={forecast.lower} />

      {finalMedian !== null && (
        <p className="mt-2 font-mono text-[10px] text-white/30">
          Median close in {forecast.horizon} bars: {formatMnqPrice(finalMedian)}
        </p>
      )}
    </section>
  );
}

/** Median line inside a percentile band. */
function ForecastSpark({ median, upper, lower }: { median: number[]; upper: number[]; lower: number[] }) {
  if (median.length < 2) return null;

  const all = [...upper, ...lower, ...median];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;

  const width = 100;
  const height = 40;
  const x = (index: number) => (index / (median.length - 1)) * width;
  const y = (value: number) => height - ((value - min) / span) * height;

  const bandPath = [
    `M ${x(0)} ${y(upper[0])}`,
    ...upper.map((value, index) => `L ${x(index)} ${y(value)}`),
    ...lower
      .map((value, index) => ({ value, index }))
      .reverse()
      .map(({ value, index }) => `L ${x(index)} ${y(value)}`),
    "Z",
  ].join(" ");

  const medianPath = median.map((value, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(value)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-10 w-full" aria-hidden>
      <path d={bandPath} fill="rgba(139,92,246,0.18)" />
      <path d={medianPath} fill="none" stroke="#a78bfa" strokeWidth={1} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

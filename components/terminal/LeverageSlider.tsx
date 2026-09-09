"use client";

import { AlertTriangle } from "lucide-react";
import {
  leverageFromSliderValue,
  liquidationDistancePercent,
  sliderValueFromLeverage,
  clampLeverage,
  MAX_LEVERAGE,
  MIN_LEVERAGE,
} from "@/lib/calculations";
import { cn } from "@/lib/utils";

interface LeverageSliderProps {
  leverage: number;
  onChange: (leverage: number) => void;
}

const PRESETS = [500, 600, 750, 850, 1000];

export function LeverageSlider({ leverage, onChange }: LeverageSliderProps) {
  const sliderValue = sliderValueFromLeverage(leverage);
  // The whole range starts at 500x, so every setting is extreme by any normal
  // measure - there's no "safe" end of this slider to reassure anyone about,
  // which is why the track starts amber rather than green.
  const distance = liquidationDistancePercent(leverage);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-white/70">Leverage</span>
        <span className="font-mono text-2xl font-bold tabular-nums text-rose-400">
          {leverage}
          <span className="text-base font-semibold text-rose-400/70">x</span>
        </span>
      </div>

      <div className="relative mt-3 h-11">
        {/* Custom track. The native input sits transparent on top so keyboard
            control, drag behaviour and screen-reader semantics all still come
            from the real control rather than being reimplemented. */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2">
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 transition-[width] duration-100"
              style={{ width: `${sliderValue}%` }}
            />
          </div>
        </div>

        <div
          className="pointer-events-none absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/90 bg-rose-500 shadow-[0_0_14px_rgba(244,63,94,0.65)] transition-[left] duration-100"
          style={{ left: `${sliderValue}%` }}
        />

        <input
          type="range"
          min={0}
          max={100}
          value={sliderValue}
          onChange={(event) => onChange(leverageFromSliderValue(Number(event.target.value)))}
          aria-label="Leverage"
          aria-valuetext={`${leverage}x`}
          className={cn(
            "absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-base-950",
            "[&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:opacity-0",
            "[&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:opacity-0"
          )}
        />
      </div>

      <div className="mt-1 flex justify-between font-mono text-[11px] text-white/30">
        <span>{MIN_LEVERAGE}x</span>
        <span>{(MIN_LEVERAGE + MAX_LEVERAGE) / 2}x</span>
        <span>{MAX_LEVERAGE}x</span>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {PRESETS.map((preset) => {
          const value = clampLeverage(preset);
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(value)}
              aria-pressed={leverage === value}
              className={cn(
                "min-h-8 rounded-lg border font-mono text-xs font-medium transition-colors",
                leverage === value
                  ? "border-rose-500/50 bg-rose-500/15 text-rose-200"
                  : "border-white/10 text-white/50 hover:border-white/20 hover:text-white/80"
              )}
            >
              {preset}x
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          At {leverage}x a{" "}
          <span className="font-mono font-semibold">{distance.toFixed(3)}%</span> move in
          the <span className="font-semibold">price</span> against you liquidates the
          position and loses the margin - your P&amp;L moves {leverage}x faster than the
          price does. Bitcoin covers that in seconds.
        </span>
      </div>
    </div>
  );
}

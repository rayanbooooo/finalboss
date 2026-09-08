"use client";

import { AlertTriangle } from "lucide-react";
import { leverageFromSliderValue, sliderValueFromLeverage } from "@/lib/calculations";
import { cn } from "@/lib/utils";

interface LeverageSliderProps {
  leverage: number;
  onChange: (leverage: number) => void;
}

const HIGH_RISK_THRESHOLD = 100;

export function LeverageSlider({ leverage, onChange }: LeverageSliderProps) {
  const sliderValue = sliderValueFromLeverage(leverage);
  const highRisk = leverage >= HIGH_RISK_THRESHOLD;

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white/70">Leverage</span>
        <span
          className={cn(
            "font-mono text-lg font-bold",
            highRisk ? "text-rose-400" : "text-violet-300"
          )}
        >
          {leverage}x
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={sliderValue}
        onChange={(event) => onChange(leverageFromSliderValue(Number(event.target.value)))}
        aria-label="Leverage"
        className={cn(
          "mt-3 h-11 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-violet-500",
          "[&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-400 [&::-webkit-slider-thumb]:shadow-glow-violet",
          "[&::-moz-range-thumb]:h-7 [&::-moz-range-thumb]:w-7 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-violet-400"
        )}
      />

      <div className="mt-1.5 flex justify-between text-[11px] text-white/30">
        <span>1x</span>
        <span>250x</span>
        <span>500x</span>
        <span>1000x</span>
      </div>

      {highRisk && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Extreme leverage. A small price move against your position can trigger
            liquidation almost instantly.
          </span>
        </div>
      )}
    </div>
  );
}

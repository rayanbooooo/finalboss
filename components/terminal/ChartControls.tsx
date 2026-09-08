"use client";

import { TIMEFRAMES, type Timeframe } from "@/lib/timeframes";
import { cn } from "@/lib/utils";

interface ChartControlsProps {
  value: Timeframe;
  onChange: (timeframe: Timeframe) => void;
}

export function ChartControls({ value, onChange }: ChartControlsProps) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Chart timeframe">
      {TIMEFRAMES.map((timeframe) => {
        const active = timeframe.label === value.label;
        return (
          <button
            key={timeframe.label}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(timeframe)}
            className={cn(
              "min-h-8 rounded-lg px-2.5 font-mono text-xs font-semibold transition-colors",
              active ? "bg-violet-600 text-white" : "text-white/40 hover:bg-white/5 hover:text-white/80"
            )}
          >
            {timeframe.label}
          </button>
        );
      })}
    </div>
  );
}

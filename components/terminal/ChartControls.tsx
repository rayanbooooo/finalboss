"use client";

import { TIMEFRAMES, type Timeframe } from "@/lib/timeframes";
import { cn } from "@/lib/utils";

interface ChartControlsProps {
  value: Timeframe;
  onChange: (timeframe: Timeframe) => void;
}

export function ChartControls({ value, onChange }: ChartControlsProps) {
  return (
    // Six timeframes fit a phone, but only just, and a longer label added later
    // would silently push the expand button off-screen. Scroll rather than clip.
    <div
      className="-mx-1 flex min-w-0 items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="group"
      aria-label="Chart timeframe"
    >
      {TIMEFRAMES.map((timeframe) => {
        const active = timeframe.label === value.label;
        return (
          <button
            key={timeframe.label}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(timeframe)}
            className={cn(
              "min-h-8 shrink-0 rounded-lg px-2.5 font-mono text-xs font-semibold transition-colors",
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

"use client";

import { useMemo, useState, type MouseEvent } from "react";
import type { Candle } from "@/types/market";
import { formatCurrency, formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";

interface CandlestickChartProps {
  candles: Candle[];
  currentPrice: number;
  heightClassName?: string;
  interactive?: boolean;
}

const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 380;
const PADDING_Y = 20;

export function CandlestickChart({
  candles,
  currentPrice,
  heightClassName = "h-[260px] sm:h-[380px]",
  interactive = true,
}: CandlestickChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { min, max, candleWidth, gap } = useMemo(() => {
    if (candles.length === 0) {
      return { min: 0, max: 1, candleWidth: 0, gap: 0 };
    }
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const rawMin = Math.min(...lows);
    const rawMax = Math.max(...highs, currentPrice);
    const padding = (rawMax - rawMin) * 0.08 || rawMax * 0.01;
    const gap = 2;
    const width = VIEW_WIDTH / candles.length;
    return {
      min: rawMin - padding,
      max: rawMax + padding,
      candleWidth: Math.max(width - gap, 1),
      gap,
    };
  }, [candles, currentPrice]);

  const priceToY = (price: number) => {
    if (max === min) return VIEW_HEIGHT / 2;
    const ratio = (price - min) / (max - min);
    return VIEW_HEIGHT - PADDING_Y - ratio * (VIEW_HEIGHT - PADDING_Y * 2);
  };

  const handleMove = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH;
    const index = Math.min(
      candles.length - 1,
      Math.max(0, Math.floor(x / (candleWidth + gap)))
    );
    setHoverIndex(index);
  };

  const hovered = hoverIndex !== null ? candles[hoverIndex] : null;
  const currentY = priceToY(currentPrice);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="none"
        className={cn("w-full touch-none", heightClassName)}
        onMouseMove={interactive ? handleMove : undefined}
        onMouseLeave={interactive ? () => setHoverIndex(null) : undefined}
      >
        <defs>
          <filter id="chart-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {[0.2, 0.4, 0.6, 0.8].map((f) => (
          <line
            key={f}
            x1={0}
            x2={VIEW_WIDTH}
            y1={VIEW_HEIGHT * f}
            y2={VIEW_HEIGHT * f}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={1}
          />
        ))}

        {candles.map((candle, i) => {
          const x = i * (candleWidth + gap);
          const isUp = candle.close >= candle.open;
          const color = isUp ? "#34d399" : "#f43f5e";
          const bodyTop = priceToY(Math.max(candle.open, candle.close));
          const bodyBottom = priceToY(Math.min(candle.open, candle.close));
          const bodyHeight = Math.max(bodyBottom - bodyTop, 1);

          return (
            <g key={candle.time}>
              <line
                x1={x + candleWidth / 2}
                x2={x + candleWidth / 2}
                y1={priceToY(candle.high)}
                y2={priceToY(candle.low)}
                stroke={color}
                strokeWidth={1}
              />
              <rect
                x={x}
                y={bodyTop}
                width={candleWidth}
                height={bodyHeight}
                fill={color}
                opacity={hoverIndex === null || hoverIndex === i ? 1 : 0.55}
              />
            </g>
          );
        })}

        <line
          x1={0}
          x2={VIEW_WIDTH}
          y1={currentY}
          y2={currentY}
          stroke="#a78bfa"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          filter="url(#chart-glow)"
        />

        {hoverIndex !== null && (
          <line
            x1={hoverIndex * (candleWidth + gap) + candleWidth / 2}
            x2={hoverIndex * (candleWidth + gap) + candleWidth / 2}
            y1={0}
            y2={VIEW_HEIGHT}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={1}
          />
        )}
      </svg>

      <div className="pointer-events-none absolute right-2 top-2 rounded-md bg-violet-500/20 px-2 py-1 font-mono text-xs text-violet-200">
        {formatCurrency(currentPrice)}
      </div>

      {interactive && hovered && (
        <div className="pointer-events-none absolute left-2 top-2 rounded-lg border border-white/10 bg-base-900/90 px-3 py-2 font-mono text-xs text-white/80 shadow-xl">
          <div>{formatTimestamp(hovered.time)}</div>
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
            <span className="text-white/40">O</span>
            <span>{hovered.open.toFixed(1)}</span>
            <span className="text-white/40">H</span>
            <span>{hovered.high.toFixed(1)}</span>
            <span className="text-white/40">L</span>
            <span>{hovered.low.toFixed(1)}</span>
            <span className="text-white/40">C</span>
            <span>{hovered.close.toFixed(1)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineStyle,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "@/types/market";
import type { PositionWithPnl } from "@/hooks/usePositions";
import { formatCurrency } from "@/lib/format";

interface TradingChartProps {
  candles: Candle[];
  currentPrice: number;
  positions?: PositionWithPnl[];
  interactive?: boolean;
  heightClassName?: string;
  showPriceBadge?: boolean;
  /**
   * Identifies which logical series `candles` belongs to (e.g. the active
   * market id). A change here always forces a full setData() + fitContent(),
   * since two different series (say, switching from BTC to ETH) can
   * otherwise coincidentally share the same first-candle time and length as
   * the outgoing one, which would fool the timestamp/length-based
   * same-dataset heuristic below into only patching the last bar in place.
   */
  seriesKey?: string;
}

function toChartCandle(candle: Candle) {
  return {
    time: Math.floor(candle.time / 1000) as UTCTimestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  };
}

export function TradingChart({
  candles,
  currentPrice,
  positions = [],
  interactive = true,
  heightClassName = "h-[260px] sm:h-[380px]",
  showPriceBadge = true,
  seriesKey,
}: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const prevCandleCountRef = useRef(0);
  const prevFirstTimeRef = useRef<number | null>(null);
  const prevSeriesKeyRef = useRef<string | undefined>(undefined);
  const positionLinesRef = useRef<Map<string, IPriceLine[]>>(new Map());

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: "rgba(255,255,255,0.45)",
        fontFamily: "var(--font-geist-mono, monospace)",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: {
        mode: interactive ? CrosshairMode.Normal : CrosshairMode.Hidden,
        vertLine: { color: "rgba(167,139,250,0.4)", labelBackgroundColor: "#1c1c29" },
        horzLine: { color: "rgba(167,139,250,0.4)", labelBackgroundColor: "#1c1c29" },
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: interactive,
      handleScale: interactive,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#34d399",
      downColor: "#f43f5e",
      borderVisible: false,
      wickUpColor: "#34d399",
      wickDownColor: "#f43f5e",
      priceLineColor: "#a78bfa",
      priceLineStyle: LineStyle.Dashed,
    });

    chartRef.current = chart;
    seriesRef.current = series;
    prevCandleCountRef.current = 0;
    prevFirstTimeRef.current = null;
    prevSeriesKeyRef.current = undefined;
    positionLinesRef.current = new Map();

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chart is created once per mount; `interactive` is not expected to change at runtime
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series || candles.length === 0) return;

    const first = candles[0];
    // A genuinely new/rolled candle (or a same-candle price tick) always
    // keeps every earlier bar's time untouched - only the dataset being
    // swapped out wholesale (placeholder -> seeded data, sim -> live feed,
    // a feed reconnect) changes what the first bar's time is. Comparing
    // lengths alone isn't enough: the placeholder and the freshly-seeded
    // data are both 80 bars, so a length-only check misses that swap.
    const isWholesaleReplacement =
      prevFirstTimeRef.current === null ||
      seriesKey !== prevSeriesKeyRef.current ||
      first.time !== prevFirstTimeRef.current ||
      candles.length < prevCandleCountRef.current;

    if (isWholesaleReplacement) {
      series.setData(candles.map(toChartCandle));
      chartRef.current?.timeScale().fitContent();
    } else {
      series.update(toChartCandle(candles[candles.length - 1]));
    }

    prevCandleCountRef.current = candles.length;
    prevFirstTimeRef.current = first.time;
    prevSeriesKeyRef.current = seriesKey;
  }, [candles, seriesKey]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    const currentIds = new Set(positions.map((p) => p.id));

    for (const [id, lines] of positionLinesRef.current.entries()) {
      if (!currentIds.has(id)) {
        lines.forEach((line) => series.removePriceLine(line));
        positionLinesRef.current.delete(id);
      }
    }

    for (const position of positions) {
      if (positionLinesRef.current.has(position.id)) continue;
      const sideColor = position.side === "long" ? "#34d399" : "#f43f5e";
      const entryLine = series.createPriceLine({
        price: position.entryPrice,
        color: sideColor,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `${position.side === "long" ? "Long" : "Short"} ${position.leverage}x`,
      });
      const liqLine = series.createPriceLine({
        price: position.liquidationPrice,
        color: "#f43f5e",
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: "Liq.",
      });
      positionLinesRef.current.set(position.id, [entryLine, liqLine]);
    }
  }, [positions]);

  return (
    <div className="relative">
      <div ref={containerRef} className={heightClassName} />
      {showPriceBadge && (
        <div className="pointer-events-none absolute right-2 top-2 rounded-md bg-violet-500/20 px-2 py-1 font-mono text-xs text-violet-200">
          {formatCurrency(currentPrice)}
        </div>
      )}
    </div>
  );
}

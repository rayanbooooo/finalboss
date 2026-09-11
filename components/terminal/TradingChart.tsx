"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  LineStyle,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "@/types/market";
import type { PositionWithPnl } from "@/hooks/usePositions";
import { calcSma } from "@/lib/calculations";
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

function toChartTime(candle: Candle) {
  return Math.floor(candle.time / 1000) as UTCTimestamp;
}

function toChartCandle(candle: Candle) {
  return {
    time: toChartTime(candle),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  };
}

function toVolumeCandle(candle: Candle) {
  return {
    time: toChartTime(candle),
    value: candle.volume,
    color: candle.close >= candle.open ? "rgba(52,211,153,0.5)" : "rgba(244,63,94,0.5)",
  };
}

function toSmaPoints(candles: Candle[]) {
  const sma = calcSma(candles);
  const points: { time: UTCTimestamp; value: number }[] = [];
  candles.forEach((candle, index) => {
    const value = sma[index];
    if (value !== null) {
      points.push({ time: toChartTime(candle), value });
    }
  });
  return points;
}

export interface SeriesFrame {
  firstTime: number;
  count: number;
  seriesKey: string | undefined;
}

/**
 * Whether the incoming candles are a different dataset (redraw everything) or
 * the same one with its last bar moved on (patch that bar).
 *
 * Getting this wrong in the "same dataset" direction is the expensive
 * mistake: the chart keeps the previous series and appends one bar from the
 * new one, which drew a vertical spike when the simulator's history was still
 * on screen as the live feed arrived. seriesKey carries the data source for
 * exactly that reason - a first-bar timestamp can coincide across a swap, but
 * the key cannot.
 */
export function shouldReplaceSeries(
  next: SeriesFrame,
  prev: { firstTime: number | null; count: number; seriesKey: string | undefined }
): boolean {
  return (
    prev.firstTime === null ||
    next.seriesKey !== prev.seriesKey ||
    next.firstTime !== prev.firstTime ||
    next.count < prev.count
  );
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
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
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
        panes: {
          enableResize: true,
          separatorColor: "rgba(255,255,255,0.08)",
          separatorHoverColor: "rgba(167,139,250,0.25)",
        },
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

    const smaSeries = chart.addSeries(LineSeries, {
      color: "#facc15",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    const volumeSeries = chart.addSeries(
      HistogramSeries,
      {
        priceFormat: { type: "volume" },
        color: "#34d399",
        priceLineVisible: false,
        lastValueVisible: false,
      },
      1
    );
    chart.panes()[1]?.setStretchFactor(0.25);

    chartRef.current = chart;
    seriesRef.current = series;
    volumeSeriesRef.current = volumeSeries;
    smaSeriesRef.current = smaSeries;
    prevCandleCountRef.current = 0;
    prevFirstTimeRef.current = null;
    prevSeriesKeyRef.current = undefined;
    positionLinesRef.current = new Map();

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeSeriesRef.current = null;
      smaSeriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chart is created once per mount; `interactive` is not expected to change at runtime
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const smaSeries = smaSeriesRef.current;
    if (!series || !volumeSeries || !smaSeries || candles.length === 0) return;

    const first = candles[0];
    const isWholesaleReplacement = shouldReplaceSeries(
      { firstTime: first.time, count: candles.length, seriesKey },
      {
        firstTime: prevFirstTimeRef.current,
        count: prevCandleCountRef.current,
        seriesKey: prevSeriesKeyRef.current,
      }
    );

    if (isWholesaleReplacement) {
      series.setData(candles.map(toChartCandle));
      volumeSeries.setData(candles.map(toVolumeCandle));
      smaSeries.setData(toSmaPoints(candles));
      chartRef.current?.timeScale().fitContent();
    } else {
      const lastCandle = candles[candles.length - 1];
      series.update(toChartCandle(lastCandle));
      volumeSeries.update(toVolumeCandle(lastCandle));
      const sma = calcSma(candles);
      const lastSma = sma[sma.length - 1];
      if (lastSma !== null) {
        smaSeries.update({ time: toChartTime(lastCandle), value: lastSma });
      }
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
    <div className="relative min-h-0 flex-1">
      <div ref={containerRef} className={heightClassName} />
      {showPriceBadge && (
        <div className="pointer-events-none absolute right-2 top-2 rounded-md bg-violet-500/20 px-2 py-1 font-mono text-xs text-violet-200">
          {formatCurrency(currentPrice)}
        </div>
      )}
    </div>
  );
}

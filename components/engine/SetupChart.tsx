"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "@/types/market";
import type { ScanResult, Setup } from "@/lib/mnq/setups";
import { ZoneOverlay, type ChartZone } from "@/components/engine/zoneOverlay";
import { formatMnqPrice } from "@/lib/mnq/contract";

interface SetupChartProps {
  candles: Candle[];
  scan: ScanResult | null;
  /** The setup whose entry/stop/target are drawn as price lines. */
  selected: Setup | null;
  onSelect?: (setup: Setup) => void;
}

/** Cap how many zones are drawn; a chart shaded edge to edge shows nothing. */
const MAX_ZONES = 18;
const MAX_POOL_LINES = 6;
/**
 * Cap on drawn markers. A dense cluster of arrows is not more information, it
 * is less — overlapping labels become unreadable and hide the price action
 * they annotate. Highest-scoring win, and the selected setup is always drawn.
 */
const MAX_MARKERS = 45;

const toTime = (ms: number) => Math.floor(ms / 1000) as UTCTimestamp;

export function SetupChart({ candles, scan, selected, onSelect }: SetupChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const overlayRef = useRef<ZoneOverlay | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  // Held in a ref so the click handler is registered once, yet always calls
  // the newest callback. Re-registering it on every render would leak
  // subscriptions across the chart's lifetime.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const setupsRef = useRef<Setup[]>([]);
  setupsRef.current = scan?.setups ?? [];
  const selectedRef = useRef<Setup | null>(null);
  selectedRef.current = selected;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      layout: {
        background: { color: "transparent" },
        textColor: "rgba(255,255,255,0.55)",
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      /*
       * Pin the locale rather than inheriting navigator.language.
       *
       * lightweight-charts formats its axis labels with the browser default,
       * and a malformed tag makes Intl throw *inside* the render pass — which
       * does not surface as a broken label, it silently kills the whole paint
       * and leaves a correctly-sized but completely blank chart. Seen with a
       * container reporting "en-US@posix". Pinning it also keeps price and
       * date formatting identical for every viewer, which is what you want on
       * a trading chart anyway.
       */
      localization: { locale: "en-US" },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
      timeScale: { borderColor: "rgba(255,255,255,0.08)", timeVisible: true, secondsVisible: false },
      autoSize: true,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#34d399",
      downColor: "#fb7185",
      borderUpColor: "#34d399",
      borderDownColor: "#fb7185",
      wickUpColor: "rgba(52,211,153,0.6)",
      wickDownColor: "rgba(251,113,133,0.6)",
      priceFormat: { type: "price", precision: 2, minMove: 0.25 },
    });

    const overlay = new ZoneOverlay();
    series.attachPrimitive(overlay);

    chart.subscribeClick((param) => {
      if (!param.time || !onSelectRef.current) return;
      const clicked = param.time as UTCTimestamp;
      // Nearest setup to the clicked bar, so a click anywhere near a marker
      // selects it rather than requiring pixel precision.
      const nearest = setupsRef.current.reduce<Setup | null>((best, setup) => {
        const distance = Math.abs(toTime(setup.time) - clicked);
        if (distance > 600) return best;
        if (!best) return setup;
        return distance < Math.abs(toTime(best.time) - clicked) ? setup : best;
      }, null);
      if (nearest) onSelectRef.current(nearest);
    });

    chartRef.current = chart;
    seriesRef.current = series;
    overlayRef.current = overlay;
    markersRef.current = createSeriesMarkers(series, []);

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      overlayRef.current = null;
      markersRef.current = null;
      priceLinesRef.current = [];
    };
  }, []);

  // Bars.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || candles.length === 0) return;

    series.setData(
      candles.map((candle) => ({
        time: toTime(candle.time),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      })),
    );
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  // Zones and markers.
  useEffect(() => {
    const overlay = overlayRef.current;
    const markers = markersRef.current;
    if (!overlay || !markers || !scan) return;

    const lastTime = candles.length > 0 ? toTime(candles[candles.length - 1].time) : null;

    const zones: ChartZone[] = [
      ...scan.fvgs.map((gap) => ({
        startTime: toTime(gap.time),
        endTime: gap.mitigatedIndex !== null ? toTime(candles[gap.mitigatedIndex]?.time ?? gap.time) : null,
        low: gap.low,
        high: gap.high,
        fill: gap.direction === "bullish" ? "rgba(52,211,153,0.10)" : "rgba(251,113,133,0.10)",
        border: gap.direction === "bullish" ? "rgba(52,211,153,0.28)" : "rgba(251,113,133,0.28)",
      })),
      ...scan.orderBlocks.map((block) => ({
        startTime: toTime(block.time),
        endTime: block.mitigatedIndex !== null ? toTime(candles[block.mitigatedIndex]?.time ?? block.time) : null,
        low: block.low,
        high: block.high,
        fill: "rgba(139,92,246,0.10)",
        border: "rgba(139,92,246,0.30)",
      })),
    ]
      // Most recent zones are the ones price can still reach.
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, MAX_ZONES);

    overlay.setZones(zones);

    const ranked = [...scan.setups].sort((a, b) => b.score - a.score).slice(0, MAX_MARKERS);
    if (selectedRef.current && !ranked.some((s) => s.id === selectedRef.current?.id)) {
      ranked.push(selectedRef.current);
    }

    markers.setMarkers(
      ranked
        // lightweight-charts requires markers in ascending time order; ranking
        // by score above leaves them out of order.
        .sort((a, b) => a.time - b.time)
        .map<SeriesMarker<Time>>((setup) => ({
          time: toTime(setup.time),
          position: setup.direction === "bullish" ? "belowBar" : "aboveBar",
          shape: setup.direction === "bullish" ? "arrowUp" : "arrowDown",
          color: setup.score >= 70 ? "#a78bfa" : setup.direction === "bullish" ? "#34d399" : "#fb7185",
          // Only label the strong ones; below that the number is noise.
          text: setup.score >= 70 ? `${setup.score}` : "",
        })),
    );

    void lastTime;
  }, [scan, candles, selected]);

  // Selected setup levels.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    for (const line of priceLinesRef.current) series.removePriceLine(line);
    priceLinesRef.current = [];

    if (!selected) return;

    const levels: { price: number; color: string; title: string }[] = [
      { price: selected.entry, color: "#a78bfa", title: `ENTRY ${formatMnqPrice(selected.entry)}` },
      { price: selected.stop, color: "#fb7185", title: `STOP ${formatMnqPrice(selected.stop)}` },
      { price: selected.target, color: "#34d399", title: `TARGET ${formatMnqPrice(selected.target)}` },
    ];

    priceLinesRef.current = levels.map((level) =>
      series.createPriceLine({
        price: level.price,
        color: level.color,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: level.title,
      }),
    );

    // Untapped pools near the selected setup make the target readable as a
    // destination rather than an arbitrary multiple.
    const pools = (scan?.pools ?? [])
      .filter((pool) => pool.sweptIndex === null)
      .sort((a, b) => Math.abs(a.price - selected.entry) - Math.abs(b.price - selected.entry))
      .slice(0, MAX_POOL_LINES);

    for (const pool of pools) {
      priceLinesRef.current.push(
        series.createPriceLine({
          price: pool.price,
          color: "rgba(255,255,255,0.22)",
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: false,
          title: pool.side === "buy-side" ? "BSL" : "SSL",
        }),
      );
    }
  }, [selected, scan]);

  return <div ref={containerRef} className="h-full w-full" />;
}

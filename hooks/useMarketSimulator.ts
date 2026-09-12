"use client";

import { useEffect, useRef, useState } from "react";
import type { Candle, CandleSeries, MarketSnapshot, OrderBookSnapshot, Trade } from "@/types/market";
import {
  createFlatCandles,
  createFlatOrderBook,
  generateInitialCandles,
  generateOrderBook,
  generateTrade,
  mutateOrderBook,
  nextCandle,
  nextTick,
} from "@/lib/marketSimulator";
import type { MarketConfig } from "@/lib/markets";
import { BASE_GRANULARITY, GRANULARITIES, granularityMs } from "@/lib/timeframes";

const PRICE_TICK_MS = 1200;
const ORDERBOOK_TICK_MS = 1500;
const TRADE_TICK_MS = 900;
const MAX_TRADES = 40;
const VOLUME_BASELINE_FACTOR = 2650;
/** Matches the live path's per-request cap, so a simulated timeframe spans the
 * same range as the real one it stands in for. */
const SIM_BARS = 300;
/** Hourly bars, so a "24h" figure is actually computed over 24 hours. */
const HOURS_IN_DAY = 24;

type MakeCandles = (count: number, price: number, intervalMs: number) => Candle[];

/**
 * One series per supported granularity, each seeded at its own bar width.
 *
 * Generating each natively is what keeps a simulated 1D chart a year deep
 * instead of a resampling of five hours of minute bars - the same reason the
 * live path fetches per granularity.
 */
function buildSeries(price: number, make: MakeCandles): CandleSeries {
  const series: CandleSeries = {};
  for (const granularity of GRANULARITIES) {
    series[granularity] = make(SIM_BARS, price, granularityMs(granularity));
  }
  return series;
}

/**
 * Rolls a price into every series at that series' own bar width.
 *
 * The bar width has to come from the granularity. A previous version rolled a
 * new bar every 4 seconds to look busy, into an array capped at 500 bars: from
 * 300 seeded minute bars it filled up in about thirteen minutes and then evicted
 * one seeded bar every four seconds, so after roughly half an hour the entire
 * five hours of history was gone and the visible window was shrinking as you
 * watched it.
 */
function rollSeries(series: CandleSeries, price: number): CandleSeries {
  const next: CandleSeries = {};
  for (const key of Object.keys(series)) {
    const granularity = Number(key);
    const bars = series[granularity];
    next[granularity] = bars ? nextCandle(bars, price, granularity * 1000) : bars;
  }
  return next;
}

function addVolume(series: CandleSeries, size: number): CandleSeries {
  const next: CandleSeries = {};
  for (const key of Object.keys(series)) {
    const granularity = Number(key);
    const bars = series[granularity];
    if (!bars || bars.length === 0) {
      next[granularity] = bars;
      continue;
    }
    const last = bars[bars.length - 1];
    next[granularity] = [...bars.slice(0, -1), { ...last, volume: last.volume + size }];
  }
  return next;
}

/**
 * Client-side fallback engine for one market, used whenever its real feed
 * (hooks/useMultiMarketFeed.ts) is unreachable. `config` is a static entry
 * from lib/markets.ts - always the same object at a given call site - so
 * the values it seeds intervals/effects with below never change per call
 * site and are safe to leave out of those effects' dependency arrays.
 *
 * `realAnchorPrice` is the market's last real traded price once the (plain
 * HTTPS, no persistent connection needed) historical-candles fetch in
 * useMultiMarketFeed succeeds, even if the websocket never manages to go
 * live. Without it, a market stuck in fallback mode would mean-revert
 * toward lib/markets.ts's hardcoded seed price forever - fine on day one,
 * increasingly wrong as real prices move on, and the reason two separate
 * page loads that both land in fallback mode could show two very different
 * "simulated" numbers instead of both tracking near the truth.
 */
export function useMarketSimulator(
  config: MarketConfig,
  realAnchorPrice?: number
): MarketSnapshot {
  const { symbol, seedPrice } = config;
  const [price, setPrice] = useState(seedPrice);
  const [series, setSeries] = useState<CandleSeries>(() =>
    buildSeries(seedPrice, createFlatCandles)
  );
  const [orderbook, setOrderbook] = useState<OrderBookSnapshot>(() =>
    createFlatOrderBook(seedPrice)
  );
  const [trades, setTrades] = useState<Trade[]>([]);
  const [volume24h, setVolume24h] = useState(seedPrice * VOLUME_BASELINE_FACTOR);
  const [prevPrice, setPrevPrice] = useState(price);
  const priceRef = useRef(price);
  const anchorRef = useRef(realAnchorPrice);
  const hasSnappedToAnchorRef = useRef(false);

  useEffect(() => {
    priceRef.current = price;
  }, [price]);

  useEffect(() => {
    anchorRef.current = realAnchorPrice;
  }, [realAnchorPrice]);

  // Swap the deterministic SSR-safe placeholder data for randomized data
  // once mounted on the client, so hydration never has to reconcile
  // Math.random()-derived output against the server-rendered HTML.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setSeries(buildSeries(seedPrice, generateInitialCandles));
      setOrderbook(generateOrderBook(seedPrice));
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The first time a real anchor price shows up, snap onto it once so the
  // fallback starts near reality instead of the static seed - later anchor
  // refreshes just shift where future ticks mean-revert to (below), so the
  // series keeps evolving smoothly rather than jumping every time.
  useEffect(() => {
    if (realAnchorPrice === undefined || hasSnappedToAnchorRef.current) return undefined;
    hasSnappedToAnchorRef.current = true;
    const raf = requestAnimationFrame(() => {
      setPrice(realAnchorPrice);
      setSeries(buildSeries(realAnchorPrice, generateInitialCandles));
    });
    return () => cancelAnimationFrame(raf);
  }, [realAnchorPrice]);

  if (price !== prevPrice) {
    setPrevPrice(price);
    setSeries((prev) => rollSeries(prev, price));
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setPrice((prev) => nextTick(prev, anchorRef.current ?? seedPrice));
    }, PRICE_TICK_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setOrderbook((prev) => mutateOrderBook(prev, priceRef.current));
    }, ORDERBOOK_TICK_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const trade = generateTrade(priceRef.current);
      setTrades((prev) => [trade, ...prev].slice(0, MAX_TRADES));
      setVolume24h((prev) => prev + trade.price * trade.size);
      setSeries((prev) => addVolume(prev, trade.size));
    }, TRADE_TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const candles: Candle[] = series[BASE_GRANULARITY] ?? [];
  // Computed off the hourly series rather than the minute one: 300 minute bars
  // is five hours, so a high taken from them would be a five-hour high wearing
  // a "24h" label.
  const day = (series[3600] ?? []).slice(-HOURS_IN_DAY);
  const dayOpen = day[0]?.open ?? 0;
  const change24hPct = dayOpen > 0 ? ((price - dayOpen) / dayOpen) * 100 : 0;
  const high24h = day.length ? Math.max(...day.map((c) => c.high)) : price;
  const low24h = day.length ? Math.min(...day.map((c) => c.low)) : price;

  return {
    symbol,
    price,
    candles,
    series,
    orderbook,
    trades,
    change24hPct,
    high24h,
    low24h,
    volume24h,
    isLive: false,
  };
}

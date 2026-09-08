"use client";

import { useEffect, useRef, useState } from "react";
import type { Candle, MarketSnapshot, OrderBookSnapshot, Trade } from "@/types/market";
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

const CANDLE_INTERVAL_MS = 4000;
const PRICE_TICK_MS = 1200;
const ORDERBOOK_TICK_MS = 1500;
const TRADE_TICK_MS = 900;
const MAX_TRADES = 40;
const VOLUME_BASELINE_FACTOR = 2650;
// Matches the real feed's coarse Coinbase granularity (3600s) so the
// SIMULATED fallback's 1H/4H timeframes have the same plausible depth as
// the LIVE path, not just an aggregation of the fine-grained series.
const LONG_RANGE_INTERVAL_MS = 60 * 60_000;

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
  const [candles, setCandles] = useState<Candle[]>(() => createFlatCandles(300, seedPrice));
  const [longRangeCandles, setLongRangeCandles] = useState<Candle[]>(() =>
    createFlatCandles(300, seedPrice, LONG_RANGE_INTERVAL_MS)
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
      setCandles(generateInitialCandles(300, seedPrice));
      setLongRangeCandles(generateInitialCandles(300, seedPrice, LONG_RANGE_INTERVAL_MS));
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
      setCandles(generateInitialCandles(300, realAnchorPrice));
      setLongRangeCandles(generateInitialCandles(300, realAnchorPrice, LONG_RANGE_INTERVAL_MS));
    });
    return () => cancelAnimationFrame(raf);
  }, [realAnchorPrice]);

  if (price !== prevPrice) {
    setPrevPrice(price);
    setCandles((prev) => nextCandle(prev, price, CANDLE_INTERVAL_MS));
    setLongRangeCandles((prev) => nextCandle(prev, price, LONG_RANGE_INTERVAL_MS));
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
      setCandles((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        return [...prev.slice(0, -1), { ...last, volume: last.volume + trade.size }];
      });
    }, TRADE_TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const first = candles[0];
  const change24hPct = first && first.open > 0 ? ((price - first.open) / first.open) * 100 : 0;
  const high24h = candles.length ? Math.max(...candles.map((c) => c.high)) : price;
  const low24h = candles.length ? Math.min(...candles.map((c) => c.low)) : price;

  return {
    symbol,
    price,
    candles,
    longRangeCandles,
    orderbook,
    trades,
    change24hPct,
    high24h,
    low24h,
    volume24h,
    isLive: false,
  };
}

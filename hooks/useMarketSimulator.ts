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

/**
 * Client-side fallback engine for one market, used whenever its real feed
 * (hooks/useMultiMarketFeed.ts) is unreachable. `config` is a static entry
 * from lib/markets.ts - always the same object at a given call site - so
 * the values it seeds intervals/effects with below never change per call
 * site and are safe to leave out of those effects' dependency arrays.
 */
export function useMarketSimulator(config: MarketConfig): MarketSnapshot {
  const { symbol, seedPrice } = config;
  const [price, setPrice] = useState(seedPrice);
  const [candles, setCandles] = useState<Candle[]>(() => createFlatCandles(300, seedPrice));
  const [orderbook, setOrderbook] = useState<OrderBookSnapshot>(() =>
    createFlatOrderBook(seedPrice)
  );
  const [trades, setTrades] = useState<Trade[]>([]);
  const [volume24h, setVolume24h] = useState(seedPrice * VOLUME_BASELINE_FACTOR);
  const [prevPrice, setPrevPrice] = useState(price);
  const priceRef = useRef(price);

  useEffect(() => {
    priceRef.current = price;
  }, [price]);

  // Swap the deterministic SSR-safe placeholder data for randomized data
  // once mounted on the client, so hydration never has to reconcile
  // Math.random()-derived output against the server-rendered HTML.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setCandles(generateInitialCandles(300, seedPrice));
      setOrderbook(generateOrderBook(seedPrice));
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (price !== prevPrice) {
    setPrevPrice(price);
    setCandles((prev) => nextCandle(prev, price, CANDLE_INTERVAL_MS));
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setPrice((prev) => nextTick(prev, seedPrice));
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
    orderbook,
    trades,
    change24hPct,
    high24h,
    low24h,
    volume24h,
    isLive: false,
  };
}

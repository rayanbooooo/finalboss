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
import { ASSET_SYMBOL } from "@/lib/mockData";

const SEED_PRICE = 68000;
const CANDLE_INTERVAL_MS = 4000;
const PRICE_TICK_MS = 1200;
const ORDERBOOK_TICK_MS = 1500;
const TRADE_TICK_MS = 900;
const MAX_TRADES = 40;
const VOLUME_BASELINE = 180_000_000;

export function useMarketSimulator(): MarketSnapshot {
  const [price, setPrice] = useState(SEED_PRICE);
  const [candles, setCandles] = useState<Candle[]>(() => createFlatCandles(80, SEED_PRICE));
  const [orderbook, setOrderbook] = useState<OrderBookSnapshot>(() =>
    createFlatOrderBook(SEED_PRICE)
  );
  const [trades, setTrades] = useState<Trade[]>([]);
  const [volume24h, setVolume24h] = useState(VOLUME_BASELINE);
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
      setCandles(generateInitialCandles(80, SEED_PRICE));
      setOrderbook(generateOrderBook(SEED_PRICE));
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  if (price !== prevPrice) {
    setPrevPrice(price);
    setCandles((prev) => nextCandle(prev, price, CANDLE_INTERVAL_MS));
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setPrice((prev) => nextTick(prev));
    }, PRICE_TICK_MS);
    return () => clearInterval(interval);
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
    symbol: ASSET_SYMBOL,
    price,
    candles,
    orderbook,
    trades,
    change24hPct,
    high24h,
    low24h,
    volume24h,
  };
}

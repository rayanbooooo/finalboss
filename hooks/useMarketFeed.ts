"use client";

import { useEffect, useState } from "react";
import type { Candle, MarketSnapshot, OrderBookSnapshot, Trade } from "@/types/market";
import { useMarketSimulator } from "@/hooks/useMarketSimulator";
import { connectLiveFeed, fetchHistoricalCandles } from "@/lib/liveMarketFeed";
import { nextCandle } from "@/lib/marketSimulator";
import { ASSET_SYMBOL } from "@/lib/mockData";

const CONNECT_TIMEOUT_MS = 6000;
const MAX_LIVE_TRADES = 40;
const LIVE_CANDLE_INTERVAL_MS = 60_000;

/**
 * Prefers the real Coinbase feed (lib/liveMarketFeed.ts) for the BTC-PERP
 * mark price/orderbook/trade tape; falls back to the client-side simulator
 * (useMarketSimulator) if the feed is unreachable or times out. The
 * simulator keeps running the whole time as a live hot-swap fallback -
 * cheap, and it means a mid-session feed drop degrades gracefully instead
 * of freezing the UI.
 */
export function useMarketFeed(): MarketSnapshot {
  const simulated = useMarketSimulator();

  const [isLive, setIsLive] = useState(false);
  const [price, setPrice] = useState(0);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [orderbook, setOrderbook] = useState<OrderBookSnapshot>({ bids: [], asks: [] });
  const [trades, setTrades] = useState<Trade[]>([]);
  const [open24h, setOpen24h] = useState(0);
  const [high24h, setHigh24h] = useState(0);
  const [low24h, setLow24h] = useState(0);
  const [volume24h, setVolume24h] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let closeSocket: (() => void) | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let receivedLiveData = false;

    async function start() {
      let historicalCandles: Candle[];
      try {
        historicalCandles = await fetchHistoricalCandles(80);
      } catch {
        return; // stay on the simulator
      }
      if (cancelled) return;

      setCandles(historicalCandles);
      const seedPrice = historicalCandles[historicalCandles.length - 1]?.close ?? 0;
      setPrice(seedPrice);

      timeoutId = setTimeout(() => {
        if (!receivedLiveData) closeSocket?.();
      }, CONNECT_TIMEOUT_MS);

      closeSocket = connectLiveFeed({
        onTicker: (ticker) => {
          if (cancelled) return;
          receivedLiveData = true;
          setIsLive(true);
          setPrice(ticker.price);
          setOpen24h(ticker.open24h);
          setHigh24h(ticker.high24h);
          setLow24h(ticker.low24h);
          setVolume24h(ticker.volume24h);
          setCandles((prev) => nextCandle(prev, ticker.price, LIVE_CANDLE_INTERVAL_MS));
        },
        onMatch: (trade) => {
          if (cancelled) return;
          receivedLiveData = true;
          setTrades((prev) => [trade, ...prev].slice(0, MAX_LIVE_TRADES));
        },
        onBookSnapshot: (book) => {
          if (cancelled) return;
          receivedLiveData = true;
          setOrderbook(book);
        },
        onBookUpdate: (book) => {
          if (cancelled) return;
          setOrderbook(book);
        },
        onError: () => {
          if (cancelled) return;
          setIsLive(false);
        },
        onClose: () => {
          if (cancelled) return;
          setIsLive(false);
        },
      });
    }

    start();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      closeSocket?.();
    };
  }, []);

  if (isLive) {
    const change24hPct = open24h > 0 ? ((price - open24h) / open24h) * 100 : 0;
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
      isLive: true,
    };
  }

  return simulated;
}

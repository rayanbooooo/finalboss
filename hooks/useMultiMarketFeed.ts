"use client";

import { useEffect, useState } from "react";
import type { Candle, MarketSnapshot, OrderBookSnapshot, Trade } from "@/types/market";
import { useMarketSimulator } from "@/hooks/useMarketSimulator";
import { connectMultiMarketFeed, fetchHistoricalCandles } from "@/lib/liveMarketFeed";
import { nextCandle } from "@/lib/marketSimulator";
import { MARKETS, type MarketId } from "@/lib/markets";

const CONNECT_TIMEOUT_MS = 6000;
const MAX_LIVE_TRADES = 40;
const LIVE_CANDLE_INTERVAL_MS = 60_000;

interface LiveState {
  isLive: boolean;
  price: number;
  candles: Candle[];
  orderbook: OrderBookSnapshot;
  trades: Trade[];
  open24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
}

function emptyLiveState(): LiveState {
  return {
    isLive: false,
    price: 0,
    candles: [],
    orderbook: { bids: [], asks: [] },
    trades: [],
    open24h: 0,
    high24h: 0,
    low24h: 0,
    volume24h: 0,
  };
}

function markAllOffline(state: Record<MarketId, LiveState>): Record<MarketId, LiveState> {
  const next = { ...state };
  MARKETS.forEach((m) => {
    next[m.id] = { ...next[m.id], isLive: false };
  });
  return next;
}

/**
 * One shared Coinbase feed for every market in lib/markets.ts. Each market
 * also keeps its own client-side simulator (useMarketSimulator) running the
 * whole time as a hot fallback - cheap, and it means a feed drop degrades
 * that one market gracefully instead of freezing it.
 */
export function useMultiMarketFeed(): Record<MarketId, MarketSnapshot> {
  const simulators: Record<MarketId, MarketSnapshot> = {
    BTC: useMarketSimulator(MARKETS[0]),
    ETH: useMarketSimulator(MARKETS[1]),
    SOL: useMarketSimulator(MARKETS[2]),
    XRP: useMarketSimulator(MARKETS[3]),
    DOGE: useMarketSimulator(MARKETS[4]),
  };

  const [live, setLive] = useState<Record<MarketId, LiveState>>(() => {
    const init = {} as Record<MarketId, LiveState>;
    MARKETS.forEach((m) => {
      init[m.id] = emptyLiveState();
    });
    return init;
  });

  useEffect(() => {
    let cancelled = false;
    let closeSocket: (() => void) | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const receivedFor = new Set<string>();

    async function start() {
      const results = await Promise.allSettled(
        MARKETS.map((m) => fetchHistoricalCandles(m.coinbaseProductId, 300))
      );
      if (cancelled) return;

      setLive((prev) => {
        const next = { ...prev };
        results.forEach((result, i) => {
          const market = MARKETS[i];
          if (result.status === "fulfilled") {
            const seedPrice = result.value[result.value.length - 1]?.close ?? market.seedPrice;
            next[market.id] = { ...next[market.id], candles: result.value, price: seedPrice };
          }
        });
        return next;
      });

      const productIds = MARKETS.map((m) => m.coinbaseProductId);
      const idByProduct = new Map(MARKETS.map((m) => [m.coinbaseProductId, m.id]));

      timeoutId = setTimeout(() => {
        if (receivedFor.size === 0) closeSocket?.();
      }, CONNECT_TIMEOUT_MS);

      closeSocket = connectMultiMarketFeed(productIds, {
        onTicker: (productId, ticker) => {
          if (cancelled) return;
          const id = idByProduct.get(productId);
          if (!id) return;
          receivedFor.add(productId);
          setLive((prev) => ({
            ...prev,
            [id]: {
              ...prev[id],
              isLive: true,
              price: ticker.price,
              open24h: ticker.open24h,
              high24h: ticker.high24h,
              low24h: ticker.low24h,
              volume24h: ticker.volume24h,
              candles: nextCandle(prev[id].candles, ticker.price, LIVE_CANDLE_INTERVAL_MS),
            },
          }));
        },
        onMatch: (productId, trade) => {
          if (cancelled) return;
          const id = idByProduct.get(productId);
          if (!id) return;
          receivedFor.add(productId);
          setLive((prev) => ({
            ...prev,
            [id]: { ...prev[id], trades: [trade, ...prev[id].trades].slice(0, MAX_LIVE_TRADES) },
          }));
        },
        onBookSnapshot: (productId, book) => {
          if (cancelled) return;
          const id = idByProduct.get(productId);
          if (!id) return;
          receivedFor.add(productId);
          setLive((prev) => ({ ...prev, [id]: { ...prev[id], orderbook: book } }));
        },
        onBookUpdate: (productId, book) => {
          if (cancelled) return;
          const id = idByProduct.get(productId);
          if (!id) return;
          setLive((prev) => ({ ...prev, [id]: { ...prev[id], orderbook: book } }));
        },
        onError: () => {
          if (cancelled) return;
          setLive(markAllOffline);
        },
        onClose: () => {
          if (cancelled) return;
          setLive(markAllOffline);
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

  const result = {} as Record<MarketId, MarketSnapshot>;
  MARKETS.forEach((market) => {
    const state = live[market.id];
    if (state.isLive) {
      const change24hPct =
        state.open24h > 0 ? ((state.price - state.open24h) / state.open24h) * 100 : 0;
      result[market.id] = {
        symbol: market.symbol,
        price: state.price,
        candles: state.candles,
        orderbook: state.orderbook,
        trades: state.trades,
        change24hPct,
        high24h: state.high24h,
        low24h: state.low24h,
        volume24h: state.volume24h,
        isLive: true,
      };
    } else {
      result[market.id] = simulators[market.id];
    }
  });
  return result;
}

"use client";

import { useEffect, useState } from "react";
import type { Candle, MarketSnapshot, OrderBookSnapshot, Trade } from "@/types/market";
import { useMarketSimulator } from "@/hooks/useMarketSimulator";
import { connectMultiMarketFeed, fetchHistoricalCandles } from "@/lib/liveMarketFeed";
import { nextCandle } from "@/lib/marketSimulator";
import { MARKETS, type MarketId } from "@/lib/markets";

const CONNECT_TIMEOUT_MS = 8000;
const RECONNECT_DELAY_MS = 12_000;
const MAX_LIVE_TRADES = 40;
const LIVE_CANDLE_INTERVAL_MS = 60_000;
// Coinbase's candles endpoint caps out at 300 bars regardless of
// granularity, so 300 bars at 1H granularity is the deepest single request
// can go (~12.5 days) - real history for the 1H/4H timeframe buttons
// without switching data providers.
const LONG_RANGE_GRANULARITY_SECONDS = 3600;

interface LiveState {
  isLive: boolean;
  price: number;
  candles: Candle[];
  longRangeCandles: Candle[];
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
    longRangeCandles: [],
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
 * `ticker` messages drive OHLC/roll (see LIVE_CANDLE_INTERVAL_MS below) but
 * carry no per-trade size - only `match` messages do - so real trade volume
 * is accumulated onto the currently-forming candle here, independently.
 */
function addVolumeToLastCandle(candles: Candle[], size: number): Candle[] {
  if (candles.length === 0) return candles;
  const last = candles[candles.length - 1];
  return [...candles.slice(0, -1), { ...last, volume: last.volume + size }];
}

/**
 * One shared Coinbase feed for every market in lib/markets.ts. Each market
 * also keeps its own client-side simulator (useMarketSimulator) running the
 * whole time as a hot fallback - cheap, and it means a feed drop degrades
 * that one market gracefully instead of freezing it.
 */
export function useMultiMarketFeed(): Record<MarketId, MarketSnapshot> {
  const [live, setLive] = useState<Record<MarketId, LiveState>>(() => {
    const init = {} as Record<MarketId, LiveState>;
    MARKETS.forEach((m) => {
      init[m.id] = emptyLiveState();
    });
    return init;
  });

  // Once the historical-candles fetch succeeds for a market, its last real
  // price anchors that market's simulator fallback (see useMarketSimulator)
  // even if the websocket itself never goes live - candles only populate
  // from a successful fetch, so their presence is the "we have a real
  // price" signal.
  const anchorPrice = (id: MarketId): number | undefined =>
    live[id].candles.length > 0 ? live[id].price : undefined;

  const simulators: Record<MarketId, MarketSnapshot> = {
    BTC: useMarketSimulator(MARKETS[0], anchorPrice("BTC")),
    ETH: useMarketSimulator(MARKETS[1], anchorPrice("ETH")),
    SOL: useMarketSimulator(MARKETS[2], anchorPrice("SOL")),
    XRP: useMarketSimulator(MARKETS[3], anchorPrice("XRP")),
    DOGE: useMarketSimulator(MARKETS[4], anchorPrice("DOGE")),
  };

  useEffect(() => {
    let cancelled = false;
    let closeSocket: (() => void) | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let receivedFor = new Set<string>();

    // A single failed/dropped connection attempt used to strand the whole
    // session in the simulator permanently (the connect effect only ran
    // once on mount). A flaky mobile network can easily miss the initial
    // handshake window without ever being unreachable - so keep retrying
    // in the background instead of giving up after one try.
    function scheduleReconnect() {
      if (cancelled || reconnectTimeoutId) return;
      reconnectTimeoutId = setTimeout(() => {
        reconnectTimeoutId = null;
        start();
      }, RECONNECT_DELAY_MS);
    }

    async function start() {
      receivedFor = new Set<string>();

      const [results, longRangeResults] = await Promise.all([
        Promise.allSettled(MARKETS.map((m) => fetchHistoricalCandles(m.coinbaseProductId, 300))),
        Promise.allSettled(
          MARKETS.map((m) =>
            fetchHistoricalCandles(m.coinbaseProductId, 300, LONG_RANGE_GRANULARITY_SECONDS)
          )
        ),
      ]);
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
        longRangeResults.forEach((result, i) => {
          const market = MARKETS[i];
          if (result.status === "fulfilled") {
            next[market.id] = { ...next[market.id], longRangeCandles: result.value };
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
            [id]: {
              ...prev[id],
              trades: [trade, ...prev[id].trades].slice(0, MAX_LIVE_TRADES),
              candles: addVolumeToLastCandle(prev[id].candles, trade.size),
            },
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
          scheduleReconnect();
        },
        onClose: () => {
          if (cancelled) return;
          setLive(markAllOffline);
          scheduleReconnect();
        },
      });
    }

    start();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId);
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
        longRangeCandles: state.longRangeCandles,
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

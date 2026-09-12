"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Candle,
  CandleSeries,
  MarketSnapshot,
  OrderBookSnapshot,
  Trade,
} from "@/types/market";
import { useMarketSimulator } from "@/hooks/useMarketSimulator";
import {
  connectMultiMarketFeed,
  fetchHistoricalCandles,
  fetchProductStats,
} from "@/lib/liveMarketFeed";
import { nextCandle } from "@/lib/marketSimulator";
import { MARKETS, type MarketId } from "@/lib/markets";
import { BASE_GRANULARITY, granularityMs, type Granularity } from "@/lib/timeframes";

const CONNECT_TIMEOUT_MS = 8000;
const RECONNECT_DELAY_MS = 12_000;
const MAX_LIVE_TRADES = 40;
/** The base series backs the default chart view, so it is worth a second
 * request to double its depth from five hours to ten. Everything coarser is
 * already deep enough in one page. */
const BASE_PAGES = 2;

interface LiveState {
  /** The websocket is delivering right now. Drives the LIVE/SIMULATED badge. */
  isLive: boolean;
  /** Real REST history has landed for this market. Separate from `isLive`
   * because they fail independently: after a socket drop we still hold real
   * candles, and replacing them with simulated ones (which is what keying this
   * off `isLive` used to do) is how a synthetic history gets spliced onto a
   * real one. */
  hasHistory: boolean;
  price: number;
  series: CandleSeries;
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
    hasHistory: false,
    price: 0,
    series: {},
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
 * Rolls a price into every series we have loaded, each at its own bar width, so
 * a chart stays live whichever timeframe is on screen without costing an extra
 * request per timeframe.
 */
function rollIntoSeries(series: CandleSeries, price: number): CandleSeries {
  const next: CandleSeries = {};
  for (const key of Object.keys(series)) {
    const granularity = Number(key);
    const bars = series[granularity];
    next[granularity] = bars
      ? nextCandle(bars, price, granularityMs(granularity as Granularity))
      : bars;
  }
  return next;
}

/**
 * `ticker` messages drive the OHLC roll but carry no per-trade size - only
 * `match` messages do - so real trade volume is accumulated onto the
 * currently-forming bar of each series here, independently.
 */
function addVolumeToSeries(series: CandleSeries, size: number): CandleSeries {
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

export interface MultiMarketFeed {
  markets: Record<MarketId, MarketSnapshot>;
  /**
   * Loads a timeframe's candles the first time it is opened. Idempotent per
   * (market, granularity) and safe to call on every render of a chart.
   *
   * Lazy rather than eager because five markets across six granularities is
   * thirty requests on page load, for five series anyone actually looks at.
   */
  requestSeries: (marketId: MarketId, granularity: Granularity) => void;
}

/**
 * One shared Coinbase feed for every market in lib/markets.ts. Each market
 * also keeps its own client-side simulator (useMarketSimulator) running the
 * whole time as a hot fallback - cheap, and it means an unreachable feed
 * degrades that market gracefully instead of freezing it.
 */
export function useMultiMarketFeed(): MultiMarketFeed {
  const [live, setLive] = useState<Record<MarketId, LiveState>>(() => {
    const init = {} as Record<MarketId, LiveState>;
    MARKETS.forEach((m) => {
      init[m.id] = emptyLiveState();
    });
    return init;
  });

  /** `marketId:granularity` keys already requested, so a chart can ask on every
   * render. Cleared on reconnect and replayed, so a series the user had open
   * comes back rather than staying frozen at the moment the socket died. */
  const requestedRef = useRef<Set<string>>(new Set());

  const requestSeries = useCallback((marketId: MarketId, granularity: Granularity) => {
    const key = `${marketId}:${granularity}`;
    if (requestedRef.current.has(key)) return;
    const market = MARKETS.find((m) => m.id === marketId);
    if (!market) return;
    requestedRef.current.add(key);

    const pages = granularity === BASE_GRANULARITY ? BASE_PAGES : 1;
    fetchHistoricalCandles(market.coinbaseProductId, granularity, pages)
      .then((candles) => {
        if (candles.length === 0) return;
        setLive((prev) => ({
          ...prev,
          [marketId]: {
            ...prev[marketId],
            series: { ...prev[marketId].series, [granularity]: candles },
          },
        }));
      })
      .catch(() => {
        // Let a later render retry rather than leaving the timeframe blank.
        requestedRef.current.delete(key);
      });
  }, []);

  // Once real history has landed for a market, its last real price anchors
  // that market's simulator fallback even if the websocket never goes live.
  const anchorPrice = (id: MarketId): number | undefined =>
    live[id].hasHistory ? live[id].price : undefined;

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

      const replay = Array.from(requestedRef.current);
      requestedRef.current.clear();

      // Base candles and the 24h stats together: the header needs real
      // open/high/low/volume from the first paint, and waiting on the socket's
      // first `ticker` for them means rendering a 0.00% change over a $0.00
      // high, which reads as a broken market rather than as pending data.
      await Promise.allSettled(
        MARKETS.map(async (market) => {
          const [candles, stats] = await Promise.all([
            fetchHistoricalCandles(market.coinbaseProductId, BASE_GRANULARITY, BASE_PAGES),
            fetchProductStats(market.coinbaseProductId),
          ]);
          if (cancelled || candles.length === 0) return;
          requestedRef.current.add(`${market.id}:${BASE_GRANULARITY}`);
          setLive((prev) => {
            const current = prev[market.id];
            return {
              ...prev,
              [market.id]: {
                ...current,
                hasHistory: true,
                // A socket that beat the REST round trip already has a fresher
                // price; don't walk it back to this snapshot's last close.
                price: current.isLive ? current.price : candles[candles.length - 1].close,
                series: { ...current.series, [BASE_GRANULARITY]: candles },
                open24h: stats?.open24h ?? current.open24h,
                high24h: stats?.high24h ?? current.high24h,
                low24h: stats?.low24h ?? current.low24h,
                volume24h: stats?.volume24h ?? current.volume24h,
              },
            };
          });
        })
      );
      if (cancelled) return;

      // Bring back any coarser timeframe the user already had open.
      replay.forEach((key) => {
        const separator = key.lastIndexOf(":");
        const marketId = key.slice(0, separator) as MarketId;
        const granularity = Number(key.slice(separator + 1)) as Granularity;
        if (granularity !== BASE_GRANULARITY) requestSeries(marketId, granularity);
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
              series: rollIntoSeries(prev[id].series, ticker.price),
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
              series: addVolumeToSeries(prev[id].series, trade.size),
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
  }, [requestSeries]);

  const markets = {} as Record<MarketId, MarketSnapshot>;
  MARKETS.forEach((market) => {
    const state = live[market.id];
    // Keyed on real history rather than on the socket: a dropped connection
    // must not swap a real chart back to a synthetic one behind the user.
    if (state.hasHistory) {
      const change24hPct =
        state.open24h > 0 ? ((state.price - state.open24h) / state.open24h) * 100 : 0;
      const base: Candle[] = state.series[BASE_GRANULARITY] ?? [];
      markets[market.id] = {
        symbol: market.symbol,
        price: state.price,
        candles: base,
        series: state.series,
        orderbook: state.orderbook,
        trades: state.trades,
        change24hPct,
        high24h: state.high24h,
        low24h: state.low24h,
        volume24h: state.volume24h,
        isLive: state.isLive,
      };
    } else {
      markets[market.id] = simulators[market.id];
    }
  });

  return { markets, requestSeries };
}

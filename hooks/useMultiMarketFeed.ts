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
  startTickerPolling,
  type TickerUpdate,
} from "@/lib/liveMarketFeed";
import { nextCandle } from "@/lib/marketSimulator";
import { MARKETS, type MarketId } from "@/lib/markets";
import { BASE_GRANULARITY, granularityMs, type Granularity } from "@/lib/timeframes";

const CONNECT_TIMEOUT_MS = 8000;
const RECONNECT_DELAY_MS = 12_000;
const MAX_LIVE_TRADES = 40;

interface LiveState {
  /** The websocket is delivering right now. Note this is NOT the badge: real
   * candles stay real after a socket drop. See MarketSnapshot.isStreaming. */
  isStreaming: boolean;
  /** Real REST history has landed for this market. Separate from `isStreaming`
   * because they fail independently: after a socket drop we still hold real
   * candles, and replacing them with simulated ones (which is what keying this
   * off the socket used to do) is how a synthetic history gets spliced onto a
   * real one. It is also what makes the snapshot's `isLive` true. */
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
    isStreaming: false,
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
    next[m.id] = { ...next[m.id], isStreaming: false };
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
 * One shared Bybit feed for every market in lib/markets.ts - the same venue the
 * terminal places orders on, so the chart and the fill refer to the same
 * instrument. Bybit returns up to 1000 bars per request, so no timeframe needs
 * paging. Each market
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

    fetchHistoricalCandles(market.bybitSymbol, granularity)
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
    let stopPolling: (() => void) | null = null;
    let receivedFor = new Set<string>();
    const idBySymbol = new Map(MARKETS.map((m) => [m.bybitSymbol, m.id]));

    /** Shared by the socket and the polling fallback so both feed the chart,
     * the header and the 24h figures through exactly one path. */
    function applyTicker(symbol: string, ticker: TickerUpdate, streaming: boolean) {
      if (cancelled) return;
      const id = idBySymbol.get(symbol);
      if (!id) return;
      setLive((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          isStreaming: streaming,
          price: ticker.price,
          open24h: ticker.open24h,
          high24h: ticker.high24h,
          low24h: ticker.low24h,
          volume24h: ticker.volume24h,
          series: rollIntoSeries(prev[id].series, ticker.price),
        },
      }));
    }

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

    // The websocket is the only part of the feed with no proxy fallback, so a
    // visitor Bybit will not serve directly gets real candles and then a price
    // that never moves again. Polling covers exactly that gap, and the socket
    // takes over the moment it delivers anything.
    function beginPolling() {
      if (cancelled || stopPolling) return;
      stopPolling = startTickerPolling(
        MARKETS.map((m) => m.bybitSymbol),
        (symbol, ticker) => applyTicker(symbol, ticker, false)
      );
    }

    function endPolling() {
      stopPolling?.();
      stopPolling = null;
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
            fetchHistoricalCandles(market.bybitSymbol, BASE_GRANULARITY),
            fetchProductStats(market.bybitSymbol),
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
                price: current.isStreaming ? current.price : candles[candles.length - 1].close,
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

      const symbols = MARKETS.map((m) => m.bybitSymbol);

      timeoutId = setTimeout(() => {
        if (receivedFor.size === 0) closeSocket?.();
      }, CONNECT_TIMEOUT_MS);

      closeSocket = connectMultiMarketFeed(symbols, {
        onTicker: (symbol, ticker) => {
          if (cancelled) return;
          // The stream is fresher than a six-second poll, so it wins as soon
          // as it produces anything.
          endPolling();
          receivedFor.add(symbol);
          applyTicker(symbol, ticker, true);
        },
        onMatch: (symbol, trade) => {
          if (cancelled) return;
          const id = idBySymbol.get(symbol);
          if (!id) return;
          receivedFor.add(symbol);
          setLive((prev) => ({
            ...prev,
            [id]: {
              ...prev[id],
              trades: [trade, ...prev[id].trades].slice(0, MAX_LIVE_TRADES),
              series: addVolumeToSeries(prev[id].series, trade.size),
            },
          }));
        },
        onBookSnapshot: (symbol, book) => {
          if (cancelled) return;
          const id = idBySymbol.get(symbol);
          if (!id) return;
          receivedFor.add(symbol);
          setLive((prev) => ({ ...prev, [id]: { ...prev[id], orderbook: book } }));
        },
        onBookUpdate: (symbol, book) => {
          if (cancelled) return;
          const id = idBySymbol.get(symbol);
          if (!id) return;
          setLive((prev) => ({ ...prev, [id]: { ...prev[id], orderbook: book } }));
        },
        onError: () => {
          if (cancelled) return;
          setLive(markAllOffline);
          beginPolling();
          scheduleReconnect();
        },
        onClose: () => {
          if (cancelled) return;
          setLive(markAllOffline);
          beginPolling();
          scheduleReconnect();
        },
      });
    }

    start();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId);
      endPolling();
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
        // hasHistory is true in this branch, so every candle and the price are
        // real Bybit data whatever the socket is doing.
        isLive: true,
        isStreaming: state.isStreaming,
      };
    } else {
      markets[market.id] = simulators[market.id];
    }
  });

  return { markets, requestSeries };
}

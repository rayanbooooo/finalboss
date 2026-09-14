export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBookLevel {
  price: number;
  size: number;
}

export interface OrderBookSnapshot {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

export interface Trade {
  id: string;
  price: number;
  size: number;
  side: "buy" | "sell";
  time: number;
}

/**
 * Candle series keyed by Coinbase granularity in seconds (60, 300, 900, 3600,
 * 21600, 86400 - see lib/timeframes.ts).
 *
 * Every timeframe gets its own natively-fetched series rather than being
 * resampled from the minute bars, because resampling cannot invent history it
 * was never given: 300 one-minute bars is five hours, so a "15m" view built
 * from them showed twenty bars of those same five hours. Entries are populated
 * lazily - only the base series is guaranteed present.
 */
export type CandleSeries = Record<number, Candle[] | undefined>;

export interface MarketSnapshot {
  symbol: string;
  price: number;
  /** The base series, and the same array as `series[BASE_GRANULARITY]`. Its own
   * field because the landing sparklines always want whichever series is kept
   * loaded and shouldn't have to reason about granularity keys. */
  candles: Candle[];
  series: CandleSeries;
  orderbook: OrderBookSnapshot;
  trades: Trade[];
  change24hPct: number;
  high24h: number;
  low24h: number;
  /** Base-asset volume over 24h - BTC, not dollars. */
  volume24h: number;
  /** 24h volume in quote currency (USDT). This is the one to put a $ in front
   * of; volume24h counts coins and was being rendered as money. */
  turnover24h: number;
  /** Notional value of all open positions on the venue, in quote currency.
   * Zero in the simulator, which has no venue to have positions on. */
  openInterestUsd: number;
  /**
   * True when these prices are real Bybit data rather than the client-side
   * simulator. This is what the LIVE / SIMULATED badge means, and the terms
   * page describes it in exactly those terms: whose numbers these are, not how
   * fast they arrive.
   */
  isLive: boolean;
  /**
   * True only while the websocket is delivering.
   *
   * Separate from `isLive` because a dropped socket does not make real candles
   * synthetic. Real data reaching us by a six-second REST poll - the fallback
   * for visitors Bybit will not stream to - is still real, and labelling it
   * SIMULATED was a lie in the direction of scaring people off their own
   * chart. Use this only for things that genuinely depend on a live stream,
   * like the order book.
   */
  isStreaming: boolean;
}

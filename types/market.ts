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
  /** The base (1-minute) series, and the same array as `series[60]`. Its own
   * field because the sparklines and 24h stats always want the finest bars and
   * shouldn't have to reason about granularity keys. */
  candles: Candle[];
  series: CandleSeries;
  orderbook: OrderBookSnapshot;
  trades: Trade[];
  change24hPct: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  /** True when price/orderbook/trades come from the real Coinbase feed
   * rather than the client-side simulator (e.g. feed unreachable). */
  isLive: boolean;
}

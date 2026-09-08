export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
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

export interface MarketSnapshot {
  symbol: string;
  price: number;
  candles: Candle[];
  orderbook: OrderBookSnapshot;
  trades: Trade[];
  change24hPct: number;
  high24h: number;
  low24h: number;
  volume24h: number;
}

import type { Candle, OrderBookLevel, OrderBookSnapshot, Trade } from "@/types/market";
import { generateId } from "@/lib/utils";

/**
 * Real public market data from Coinbase Exchange (no API key required).
 * Used as the live price source for the BTC-PERP mark price (spot price as
 * a reasonable stand-in - this app has no real funding-rate curve).
 */
const REST_BASE = "https://api.exchange.coinbase.com";
const WS_URL = "wss://ws-feed.exchange.coinbase.com";
export const LIVE_PRODUCT_ID = "BTC-USD";

type RawCandle = [number, number, number, number, number, number];

export async function fetchHistoricalCandles(count = 80): Promise<Candle[]> {
  const res = await fetch(
    `${REST_BASE}/products/${LIVE_PRODUCT_ID}/candles?granularity=60`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error(`Coinbase candles request failed: ${res.status}`);
  }
  const raw = (await res.json()) as RawCandle[];
  return raw
    .slice(0, count)
    .reverse()
    .map(([time, low, high, open, close]) => ({
      time: time * 1000,
      open,
      high,
      low,
      close,
    }));
}

export interface TickerUpdate {
  price: number;
  open24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
}

interface LiveFeedHandlers {
  onOpen?: () => void;
  onTicker?: (data: TickerUpdate) => void;
  onMatch?: (trade: Trade) => void;
  onBookSnapshot?: (book: OrderBookSnapshot) => void;
  onBookUpdate?: (book: OrderBookSnapshot) => void;
  onError?: () => void;
  onClose?: () => void;
}

const ORDERBOOK_DEPTH = 12;

export function connectLiveFeed(handlers: LiveFeedHandlers): () => void {
  const socket = new WebSocket(WS_URL);
  const bids = new Map<number, number>();
  const asks = new Map<number, number>();

  function topLevels(map: Map<number, number>, side: "bids" | "asks"): OrderBookLevel[] {
    const entries = Array.from(map.entries());
    entries.sort((a, b) => (side === "bids" ? b[0] - a[0] : a[0] - b[0]));
    return entries.slice(0, ORDERBOOK_DEPTH).map(([price, size]) => ({ price, size }));
  }

  function emitBook(cb?: (book: OrderBookSnapshot) => void) {
    cb?.({ bids: topLevels(bids, "bids"), asks: topLevels(asks, "asks") });
  }

  socket.addEventListener("open", () => {
    socket.send(
      JSON.stringify({
        type: "subscribe",
        product_ids: [LIVE_PRODUCT_ID],
        channels: ["ticker", "matches", "level2_batch"],
      })
    );
    handlers.onOpen?.();
  });

  socket.addEventListener("message", (event) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(event.data as string);
    } catch {
      return;
    }

    switch (msg.type) {
      case "ticker": {
        const price = Number(msg.price);
        if (!Number.isFinite(price)) return;
        handlers.onTicker?.({
          price,
          open24h: Number(msg.open_24h) || price,
          high24h: Number(msg.high_24h) || price,
          low24h: Number(msg.low_24h) || price,
          volume24h: Number(msg.volume_24h) || 0,
        });
        break;
      }
      case "match": {
        const price = Number(msg.price);
        const size = Number(msg.size);
        if (!Number.isFinite(price) || !Number.isFinite(size)) return;
        handlers.onMatch?.({
          id: generateId("trade"),
          price,
          size,
          side: msg.side === "buy" ? "buy" : "sell",
          time: typeof msg.time === "string" ? new Date(msg.time).getTime() : Date.now(),
        });
        break;
      }
      case "snapshot": {
        bids.clear();
        asks.clear();
        for (const [priceStr, sizeStr] of (msg.bids as [string, string][]) ?? []) {
          bids.set(Number(priceStr), Number(sizeStr));
        }
        for (const [priceStr, sizeStr] of (msg.asks as [string, string][]) ?? []) {
          asks.set(Number(priceStr), Number(sizeStr));
        }
        emitBook(handlers.onBookSnapshot);
        break;
      }
      case "l2update": {
        for (const [side, priceStr, sizeStr] of (msg.changes as [string, string, string][]) ?? []) {
          const p = Number(priceStr);
          const s = Number(sizeStr);
          const map = side === "buy" ? bids : asks;
          if (s === 0) {
            map.delete(p);
          } else {
            map.set(p, s);
          }
        }
        emitBook(handlers.onBookUpdate);
        break;
      }
      default:
        break;
    }
  });

  socket.addEventListener("error", () => {
    handlers.onError?.();
  });

  socket.addEventListener("close", () => {
    handlers.onClose?.();
  });

  return () => {
    socket.close();
  };
}

import type { Candle, OrderBookLevel, OrderBookSnapshot, Trade } from "@/types/market";
import { generateId } from "@/lib/utils";

/**
 * Real public market data from Coinbase Exchange (no API key required).
 * A single websocket connection can subscribe to several products at once,
 * so every market in lib/markets.ts shares one live feed.
 */
const REST_BASE = "https://api.exchange.coinbase.com";
const WS_URL = "wss://ws-feed.exchange.coinbase.com";

type RawCandle = [number, number, number, number, number, number];

export async function fetchHistoricalCandles(
  productId: string,
  count = 80
): Promise<Candle[]> {
  const res = await fetch(`${REST_BASE}/products/${productId}/candles?granularity=60`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Coinbase candles request failed for ${productId}: ${res.status}`);
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

interface MultiMarketFeedHandlers {
  onOpen?: () => void;
  onTicker?: (productId: string, data: TickerUpdate) => void;
  onMatch?: (productId: string, trade: Trade) => void;
  onBookSnapshot?: (productId: string, book: OrderBookSnapshot) => void;
  onBookUpdate?: (productId: string, book: OrderBookSnapshot) => void;
  onError?: () => void;
  onClose?: () => void;
}

const ORDERBOOK_DEPTH = 12;

export function connectMultiMarketFeed(
  productIds: string[],
  handlers: MultiMarketFeedHandlers
): () => void {
  const socket = new WebSocket(WS_URL);
  const books = new Map<string, { bids: Map<number, number>; asks: Map<number, number> }>(
    productIds.map((id) => [id, { bids: new Map(), asks: new Map() }])
  );

  function topLevels(map: Map<number, number>, side: "bids" | "asks"): OrderBookLevel[] {
    const entries = Array.from(map.entries());
    entries.sort((a, b) => (side === "bids" ? b[0] - a[0] : a[0] - b[0]));
    return entries.slice(0, ORDERBOOK_DEPTH).map(([price, size]) => ({ price, size }));
  }

  function emitBook(
    productId: string,
    book: { bids: Map<number, number>; asks: Map<number, number> },
    cb?: (productId: string, book: OrderBookSnapshot) => void
  ) {
    cb?.(productId, { bids: topLevels(book.bids, "bids"), asks: topLevels(book.asks, "asks") });
  }

  socket.addEventListener("open", () => {
    socket.send(
      JSON.stringify({
        type: "subscribe",
        product_ids: productIds,
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

    const productId = typeof msg.product_id === "string" ? msg.product_id : null;
    if (!productId) return;
    const book = books.get(productId);
    if (!book) return;

    switch (msg.type) {
      case "ticker": {
        const price = Number(msg.price);
        if (!Number.isFinite(price)) return;
        handlers.onTicker?.(productId, {
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
        handlers.onMatch?.(productId, {
          id: generateId("trade"),
          price,
          size,
          side: msg.side === "buy" ? "buy" : "sell",
          time: typeof msg.time === "string" ? new Date(msg.time).getTime() : Date.now(),
        });
        break;
      }
      case "snapshot": {
        book.bids.clear();
        book.asks.clear();
        for (const [priceStr, sizeStr] of (msg.bids as [string, string][]) ?? []) {
          book.bids.set(Number(priceStr), Number(sizeStr));
        }
        for (const [priceStr, sizeStr] of (msg.asks as [string, string][]) ?? []) {
          book.asks.set(Number(priceStr), Number(sizeStr));
        }
        emitBook(productId, book, handlers.onBookSnapshot);
        break;
      }
      case "l2update": {
        for (const [side, priceStr, sizeStr] of (msg.changes as [string, string, string][]) ?? []) {
          const p = Number(priceStr);
          const s = Number(sizeStr);
          const map = side === "buy" ? book.bids : book.asks;
          if (s === 0) {
            map.delete(p);
          } else {
            map.set(p, s);
          }
        }
        emitBook(productId, book, handlers.onBookUpdate);
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

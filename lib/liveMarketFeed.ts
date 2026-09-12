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

/**
 * Coinbase returns at most this many buckets per response, whatever you ask
 * for. Reaching further back means walking `start`/`end` backwards a page at a
 * time - there is no "limit" parameter that lifts it.
 */
const MAX_BUCKETS_PER_REQUEST = 300;

function toCandle([time, low, high, open, close, volume]: RawCandle): Candle {
  return {
    time: time * 1000,
    open,
    high,
    low,
    close,
    volume: Number.isFinite(volume) ? volume : 0,
  };
}

/**
 * Historical candles at one of Coinbase's six supported granularities,
 * ascending by time.
 *
 * `pages` walks backwards from now, 300 buckets at a time. Without it a request
 * carrying only `granularity` returns the most recent 300 buckets and nothing
 * earlier - at `granularity=60` that is five hours, which is the entire reason
 * the chart could not show more than an afternoon.
 *
 * A page after the first failing is not fatal: partial history still draws a
 * useful chart, so we keep what arrived rather than throwing it away.
 */
export async function fetchHistoricalCandles(
  productId: string,
  granularitySeconds = 60,
  pages = 1
): Promise<Candle[]> {
  const oldestFirst: Candle[][] = [];
  let endSeconds: number | null = null;

  for (let page = 0; page < pages; page += 1) {
    const params = new URLSearchParams({ granularity: String(granularitySeconds) });
    if (endSeconds !== null) {
      const startSeconds =
        endSeconds - (MAX_BUCKETS_PER_REQUEST - 1) * granularitySeconds;
      params.set("start", new Date(startSeconds * 1000).toISOString());
      params.set("end", new Date(endSeconds * 1000).toISOString());
    }

    let raw: RawCandle[];
    try {
      const res = await fetch(`${REST_BASE}/products/${productId}/candles?${params}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`Coinbase candles request failed for ${productId}: ${res.status}`);
      }
      raw = (await res.json()) as RawCandle[];
    } catch (error) {
      if (page > 0) break;
      throw error;
    }

    if (!Array.isArray(raw) || raw.length === 0) break;

    // Coinbase returns newest-first; sorting rather than reversing keeps this
    // correct even if that ever changes.
    const ascending = raw.map(toCandle).sort((a, b) => a.time - b.time);
    oldestFirst.unshift(ascending);

    // Step back one bucket past the oldest bar we just took, so the next page
    // ends where this one starts.
    endSeconds = Math.floor(ascending[0].time / 1000) - granularitySeconds;
  }

  // Coinbase treats start/end as inclusive, so a boundary bucket can arrive in
  // two pages. A duplicate timestamp makes lightweight-charts throw outright.
  const seen = new Set<number>();
  const merged: Candle[] = [];
  for (const page of oldestFirst) {
    for (const candle of page) {
      if (seen.has(candle.time)) continue;
      seen.add(candle.time);
      merged.push(candle);
    }
  }
  return merged;
}

export interface ProductStats {
  open24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  last: number;
}

/**
 * 24h open/high/low/volume for a product.
 *
 * Fetched alongside the candles so the header carries real figures from the
 * first paint, rather than waiting on the websocket's first `ticker`. Without
 * it a market with real candle history but no socket yet had nothing to show
 * but zeros - and a 0.00% change over a $0.00 high reads as a broken market
 * rather than as missing data.
 *
 * Returns null rather than throwing: the stats are a nice-to-have next to the
 * candles, and a failure here must not cost us the chart.
 */
export async function fetchProductStats(productId: string): Promise<ProductStats | null> {
  try {
    const res = await fetch(`${REST_BASE}/products/${productId}/stats`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const raw = (await res.json()) as Record<string, string>;
    const num = (value: string | undefined): number => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    return {
      open24h: num(raw.open),
      high24h: num(raw.high),
      low24h: num(raw.low),
      volume24h: num(raw.volume),
      last: num(raw.last),
    };
  } catch {
    return null;
  }
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

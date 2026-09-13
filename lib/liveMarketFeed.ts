import type { Candle, OrderBookLevel, OrderBookSnapshot, Trade } from "@/types/market";
import { generateId } from "@/lib/utils";
import type { Granularity } from "@/lib/timeframes";
import { parseInstrument } from "@/lib/exchange/bybit";
import type { Instrument } from "@/lib/exchange/types";

/**
 * Public market data from Bybit V5 - the same venue the terminal trades on.
 *
 * This replaced Coinbase, which was a correctness problem rather than a
 * preference: quoting Coinbase's BTC-USD spot while placing orders against
 * Bybit's BTCUSDT perpetual means the chart and the fill disagree by the basis
 * between two different instruments on two different venues, and at the
 * leverage this product offers that gap is a real share of the margin.
 *
 * No API key is needed for anything in this file; the signed endpoints live in
 * lib/exchange/bybit.ts and go through the relay.
 */
const REST_BASE = "https://api.bybit.com";
const REST_BASE_TESTNET = "https://api-testnet.bybit.com";
const WS_URL = "wss://stream.bybit.com/v5/public/linear";

/** Bybit's own cap on a kline response, and far deeper than Coinbase's 300. */
const MAX_KLINE_LIMIT = 1000;

/**
 * Our granularities to Bybit's `interval` strings. Every timeframe we offer
 * maps to one Bybit supports natively, so nothing is resampled.
 */
const INTERVAL_BY_GRANULARITY: Record<Granularity, string> = {
  60: "1",
  300: "5",
  900: "15",
  3600: "60",
  21600: "360",
  86400: "D",
};

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

interface BybitEnvelope<T> {
  retCode: number;
  retMsg: string;
  result: T;
}

/**
 * Whether the browser can reach Bybit directly.
 *
 * Bybit documents its public endpoints for browser use, but a CORS refusal is
 * indistinguishable from a network error in JS and would take out the chart on
 * every page including the unauthenticated landing page. So the first failure
 * falls back to a same-origin proxy and the answer is remembered for the rest
 * of the session rather than being re-tested on every request.
 */
let useProxy = false;

async function marketGet<T>(
  path: string,
  params: Record<string, string>,
  testnet = false
): Promise<T> {
  const query = new URLSearchParams({
    ...params,
    ...(testnet ? { testnet: "1" } : {}),
  }).toString();

  async function attempt(viaProxy: boolean): Promise<T> {
    const base = testnet ? REST_BASE_TESTNET : REST_BASE;
    const url = viaProxy
      ? `/api/market?path=${encodeURIComponent(path)}&${query}`
      : `${base}${path}?${query}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Bybit ${path} failed: ${res.status}`);
    const body = (await res.json()) as BybitEnvelope<T>;
    // Bybit answers 200 with a non-zero retCode for application errors, so the
    // HTTP status alone never means success.
    if (body.retCode !== 0) {
      throw new Error(`Bybit ${path} returned ${body.retCode}: ${body.retMsg}`);
    }
    return body.result;
  }

  if (useProxy) return attempt(true);
  try {
    return await attempt(false);
  } catch {
    const result = await attempt(true);
    useProxy = true;
    return result;
  }
}

/** [startTime, open, high, low, close, volume, turnover], all strings. */
type RawKline = [string, string, string, string, string, string, string];

/**
 * Historical candles for one symbol at one granularity, ascending by time.
 *
 * One request is enough at every timeframe we offer: 1000 bars is 16 hours of
 * 1-minute candles and nearly three years of daily ones. The page-walking this
 * replaced existed only to work around Coinbase's 300-bar cap.
 */
export async function fetchHistoricalCandles(
  symbol: string,
  granularity: Granularity = 60,
  limit = MAX_KLINE_LIMIT
): Promise<Candle[]> {
  const result = await marketGet<{ list: RawKline[] }>("/v5/market/kline", {
    category: "linear",
    symbol,
    interval: INTERVAL_BY_GRANULARITY[granularity],
    limit: String(Math.min(limit, MAX_KLINE_LIMIT)),
  });

  const list = Array.isArray(result?.list) ? result.list : [];
  return list
    .map(([start, open, high, low, close, volume]) => ({
      time: num(start),
      open: num(open),
      high: num(high),
      low: num(low),
      close: num(close),
      volume: num(volume),
    }))
    // Bybit returns newest-first. Sorting rather than reversing stays correct
    // if that ever changes.
    .sort((a, b) => a.time - b.time);
}

export interface ProductStats {
  open24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  last: number;
}

/**
 * 24h open/high/low/volume for a symbol.
 *
 * Fetched alongside the candles so the header carries real figures from the
 * first paint rather than waiting on the socket's first ticker - without it a
 * market with real candles but no socket yet shows a 0.00% change over a $0.00
 * high, which reads as a broken market rather than as pending data.
 *
 * Returns null rather than throwing: these sit next to the chart and must not
 * cost us the chart.
 */
export async function fetchProductStats(symbol: string): Promise<ProductStats | null> {
  try {
    const result = await marketGet<{ list: Record<string, string>[] }>(
      "/v5/market/tickers",
      { category: "linear", symbol }
    );
    const row = result?.list?.[0];
    if (!row) return null;
    return {
      // Bybit gives the price 24h ago directly, so the change is exact rather
      // than inferred from the oldest candle we happen to hold.
      open24h: num(row.prevPrice24h),
      high24h: num(row.highPrice24h),
      low24h: num(row.lowPrice24h),
      volume24h: num(row.volume24h),
      last: num(row.lastPrice),
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

/** How often the polling fallback re-reads the tickers endpoint. */
const TICKER_POLL_MS = 6_000;

/**
 * Polls the tickers endpoint as a stand-in for the websocket.
 *
 * Every REST call in this file falls back to a same-origin proxy when the
 * browser cannot reach Bybit directly. A websocket cannot do that - there is
 * nothing to proxy it through on a serverless host. So a visitor in a country
 * Bybit refuses gets real history through the proxy and then a price frozen at
 * the last close: a chart that looks live and is not. Polling the same proxy
 * keeps the price moving for them.
 *
 * The proxy is served through a few seconds of shared CDN cache, so concurrent
 * visitors collapse onto roughly one upstream request per symbol per interval
 * rather than one each.
 */
export function startTickerPolling(
  symbols: string[],
  onTicker: (symbol: string, data: TickerUpdate) => void
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function round() {
    // Chained timeouts rather than setInterval: a slow or hanging round trip
    // must not let the next poll start on top of the one still in flight.
    await Promise.allSettled(
      symbols.map(async (symbol) => {
        const stats = await fetchProductStats(symbol);
        if (stopped || !stats || stats.last <= 0) return;
        onTicker(symbol, {
          price: stats.last,
          open24h: stats.open24h,
          high24h: stats.high24h,
          low24h: stats.low24h,
          volume24h: stats.volume24h,
        });
      })
    );
    if (stopped) return;
    timer = setTimeout(round, TICKER_POLL_MS);
  }

  void round();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

interface MultiMarketFeedHandlers {
  onOpen?: () => void;
  onTicker?: (symbol: string, data: TickerUpdate) => void;
  onMatch?: (symbol: string, trade: Trade) => void;
  onBookSnapshot?: (symbol: string, book: OrderBookSnapshot) => void;
  onBookUpdate?: (symbol: string, book: OrderBookSnapshot) => void;
  onError?: () => void;
  onClose?: () => void;
}

const ORDERBOOK_DEPTH = 12;
/** The depth channel we subscribe to; we render the top ORDERBOOK_DEPTH of it. */
const BOOK_CHANNEL_DEPTH = 50;
/** Bybit closes a public connection that has not pinged in ~30s. */
const PING_INTERVAL_MS = 20_000;
/** Bybit caps the args in a single subscribe frame. */
const MAX_SUBSCRIBE_ARGS = 10;

interface BookState {
  bids: Map<number, number>;
  asks: Map<number, number>;
  /** Last update id, used to notice a dropped delta. */
  updateId: number | null;
}

export function connectMultiMarketFeed(
  symbols: string[],
  handlers: MultiMarketFeedHandlers
): () => void {
  const socket = new WebSocket(WS_URL);
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const books = new Map<string, BookState>(
    symbols.map((s) => [s, { bids: new Map(), asks: new Map(), updateId: null }])
  );
  /**
   * Last full ticker per symbol. The linear `tickers` topic sends a snapshot
   * and then deltas carrying only the fields that changed, so a message has to
   * be merged onto what came before - taking each one as the whole truth blanks
   * the 24h figures the moment only the price moves.
   */
  const tickers = new Map<string, Record<string, string>>();

  function send(payload: unknown) {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
  }

  function topLevels(map: Map<number, number>, side: "bids" | "asks"): OrderBookLevel[] {
    const entries = Array.from(map.entries()).filter(([, size]) => size > 0);
    entries.sort((a, b) => (side === "bids" ? b[0] - a[0] : a[0] - b[0]));
    return entries.slice(0, ORDERBOOK_DEPTH).map(([price, size]) => ({ price, size }));
  }

  function emitBook(
    symbol: string,
    book: BookState,
    cb?: (symbol: string, book: OrderBookSnapshot) => void
  ) {
    cb?.(symbol, {
      bids: topLevels(book.bids, "bids"),
      asks: topLevels(book.asks, "asks"),
    });
  }

  function applyLevels(map: Map<number, number>, rows: [string, string][] | undefined) {
    for (const [priceStr, sizeStr] of rows ?? []) {
      const price = num(priceStr);
      const size = num(sizeStr);
      // A zero size is a removal, not a level with no depth.
      if (size <= 0) map.delete(price);
      else map.set(price, size);
    }
  }

  function subscribe() {
    const args = symbols.flatMap((symbol) => [
      `tickers.${symbol}`,
      `publicTrade.${symbol}`,
      `orderbook.${BOOK_CHANNEL_DEPTH}.${symbol}`,
    ]);
    for (let i = 0; i < args.length; i += MAX_SUBSCRIBE_ARGS) {
      send({ op: "subscribe", args: args.slice(i, i + MAX_SUBSCRIBE_ARGS) });
    }
  }

  socket.addEventListener("open", () => {
    subscribe();
    pingTimer = setInterval(() => send({ op: "ping" }), PING_INTERVAL_MS);
    handlers.onOpen?.();
  });

  socket.addEventListener("message", (event) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(event.data as string);
    } catch {
      return;
    }

    const topic = typeof msg.topic === "string" ? msg.topic : null;
    if (!topic) return;
    const kind = topic.split(".")[0];
    const symbol = topic.slice(topic.lastIndexOf(".") + 1);

    if (kind === "tickers") {
      const data = msg.data as Record<string, string> | undefined;
      if (!data) return;
      const merged =
        msg.type === "snapshot"
          ? data
          : { ...(tickers.get(symbol) ?? {}), ...data };
      tickers.set(symbol, merged);
      const price = num(merged.lastPrice);
      if (price <= 0) return;
      handlers.onTicker?.(symbol, {
        price,
        open24h: num(merged.prevPrice24h) || price,
        high24h: num(merged.highPrice24h) || price,
        low24h: num(merged.lowPrice24h) || price,
        volume24h: num(merged.volume24h),
      });
      return;
    }

    if (kind === "publicTrade") {
      const rows = msg.data as Record<string, string>[] | undefined;
      for (const row of rows ?? []) {
        const price = num(row.p);
        const size = num(row.v);
        if (price <= 0 || size <= 0) continue;
        handlers.onMatch?.(symbol, {
          id: generateId("trade"),
          price,
          size,
          side: row.S === "Buy" ? "buy" : "sell",
          time: num(row.T) || Date.now(),
        });
      }
      return;
    }

    if (kind === "orderbook") {
      const book = books.get(symbol);
      const data = msg.data as
        | { b?: [string, string][]; a?: [string, string][]; u?: number }
        | undefined;
      if (!book || !data) return;

      if (msg.type === "snapshot") {
        book.bids.clear();
        book.asks.clear();
        applyLevels(book.bids, data.b);
        applyLevels(book.asks, data.a);
        book.updateId = typeof data.u === "number" ? data.u : null;
        emitBook(symbol, book, handlers.onBookSnapshot);
        return;
      }

      // A missed delta leaves the book permanently wrong, and Bybit only sends
      // another snapshot on a fresh subscription - so resubscribe rather than
      // carry on displaying prices that no longer exist.
      if (
        book.updateId !== null &&
        typeof data.u === "number" &&
        data.u !== book.updateId + 1
      ) {
        book.updateId = null;
        send({ op: "unsubscribe", args: [`orderbook.${BOOK_CHANNEL_DEPTH}.${symbol}`] });
        send({ op: "subscribe", args: [`orderbook.${BOOK_CHANNEL_DEPTH}.${symbol}`] });
        return;
      }

      applyLevels(book.bids, data.b);
      applyLevels(book.asks, data.a);
      book.updateId = typeof data.u === "number" ? data.u : book.updateId;
      emitBook(symbol, book, handlers.onBookUpdate);
    }
  });

  socket.addEventListener("error", () => {
    if (!closed) handlers.onError?.();
  });

  socket.addEventListener("close", () => {
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = null;
    if (!closed) handlers.onClose?.();
  });

  return () => {
    closed = true;
    if (pingTimer) clearInterval(pingTimer);
    socket.close();
  };
}

/**
 * Trading rules for one symbol: leverage bounds, quantity step, minimum size.
 *
 * Public, so this works before a key is unlocked - which matters because the
 * leverage slider has to show the venue's real range as soon as the terminal is
 * pointed at a venue account, not only once the secret is in memory.
 */
export async function fetchInstrument(symbol: string): Promise<Instrument | null> {
  try {
    const result = await marketGet<{ list: Record<string, unknown>[] }>(
      "/v5/market/instruments-info",
      { category: "linear", symbol }
    );
    const row = result?.list?.[0];
    return row ? parseInstrument(row) : null;
  } catch {
    return null;
  }
}

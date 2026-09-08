import type { Candle, OrderBookLevel, OrderBookSnapshot, Trade } from "@/types/market";
import { clamp, generateId, randomBetween, randomInt } from "@/lib/utils";

const MEAN_REVERSION_STRENGTH = 0.002;
const MAX_TICK_PCT = 0.0012;

/**
 * Bounded random walk with mild mean-reversion toward baselinePrice (each
 * market's own seed price) so a long-running demo session never drifts to
 * implausible values.
 */
export function nextTick(prevPrice: number, baselinePrice: number): number {
  const reversion = (baselinePrice - prevPrice) * MEAN_REVERSION_STRENGTH;
  const noise = prevPrice * randomBetween(-MAX_TICK_PCT, MAX_TICK_PCT);
  const next = prevPrice + reversion + noise;
  return clamp(next, baselinePrice * 0.5, baselinePrice * 2);
}

/**
 * Deterministic (no Math.random / Date.now) placeholder data for the very
 * first render. Server-rendered HTML and the client's hydration pass must
 * produce identical output, so anything randomized has to wait until a
 * post-mount effect to avoid a hydration mismatch.
 *
 * Anchored to a fixed (not "now") epoch, one minute apart per candle, so the
 * millisecond timestamps are still properly ascending once the chart divides
 * them down to seconds - tiny sequential indices (0, 1, 2, ...) would all
 * collapse to the same second and violate lightweight-charts' ascending-time
 * requirement.
 */
const FLAT_CANDLE_ANCHOR_MS = 1_700_000_000_000;

export function createFlatCandles(count: number, price: number): Candle[] {
  const candles: Candle[] = [];
  for (let i = 0; i < count; i += 1) {
    candles.push({
      time: FLAT_CANDLE_ANCHOR_MS + i * 60_000,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: price * 0.01,
    });
  }
  return candles;
}

export function createFlatOrderBook(midPrice: number, levels = 12): OrderBookSnapshot {
  const bids: OrderBookLevel[] = [];
  const asks: OrderBookLevel[] = [];
  const tick = midPrice * 0.0004;

  for (let i = 1; i <= levels; i += 1) {
    const size = Math.max(0.05, 1 - i / levels);
    bids.push({ price: midPrice - tick * i, size });
    asks.push({ price: midPrice + tick * i, size });
  }

  return { bids, asks };
}

export function generateInitialCandles(count: number, seedPrice: number): Candle[] {
  const candles: Candle[] = [];
  let price = seedPrice;
  const now = Date.now();
  const intervalMs = 60_000;

  for (let i = count - 1; i >= 0; i -= 1) {
    const open = price;
    let high = open;
    let low = open;
    let close = open;
    let volume = 0;

    for (let s = 0; s < 6; s += 1) {
      close = nextTick(close, seedPrice);
      high = Math.max(high, close);
      low = Math.min(low, close);
      volume += randomBetween(0.2, 2) * (5000 / seedPrice);
    }

    candles.push({
      time: now - i * intervalMs,
      open,
      high,
      low,
      close,
      volume,
    });
    price = close;
  }

  return candles;
}

/**
 * Mutates the in-progress (last) candle with a new tick, or rolls a new
 * candle when the interval boundary has passed.
 */
export function nextCandle(
  candles: Candle[],
  price: number,
  intervalMs: number
): Candle[] {
  if (candles.length === 0) {
    return [{ time: Date.now(), open: price, high: price, low: price, close: price, volume: 0 }];
  }

  const last = candles[candles.length - 1];
  const elapsed = Date.now() - last.time;

  if (elapsed >= intervalMs) {
    const rolled = [
      ...candles,
      { time: Date.now(), open: last.close, high: price, low: price, close: price, volume: 0 },
    ];
    return rolled.length > 500 ? rolled.slice(rolled.length - 500) : rolled;
  }

  const updated: Candle = {
    ...last,
    high: Math.max(last.high, price),
    low: Math.min(last.low, price),
    close: price,
  };

  return [...candles.slice(0, -1), updated];
}

export function generateOrderBook(midPrice: number, levels = 12): OrderBookSnapshot {
  const bids: OrderBookLevel[] = [];
  const asks: OrderBookLevel[] = [];
  const tick = midPrice * 0.0004;

  for (let i = 1; i <= levels; i += 1) {
    const decay = Math.exp(-i / (levels / 2));
    bids.push({
      price: midPrice - tick * i,
      size: randomBetween(0.05, 3) * decay + 0.02,
    });
    asks.push({
      price: midPrice + tick * i,
      size: randomBetween(0.05, 3) * decay + 0.02,
    });
  }

  return { bids, asks };
}

export function mutateOrderBook(
  book: OrderBookSnapshot,
  midPrice: number
): OrderBookSnapshot {
  const jitterSize = (level: OrderBookLevel): OrderBookLevel => ({
    ...level,
    size: Math.max(0.01, level.size + randomBetween(-0.15, 0.15)),
  });

  const tick = midPrice * 0.0004;
  return {
    bids: book.bids.map((level, i) =>
      jitterSize({ ...level, price: midPrice - tick * (i + 1) })
    ),
    asks: book.asks.map((level, i) =>
      jitterSize({ ...level, price: midPrice + tick * (i + 1) })
    ),
  };
}

export function generateTrade(price: number): Trade {
  return {
    id: generateId("trade"),
    price: price * randomBetween(0.9998, 1.0002),
    size: randomBetween(0.001, 1.5),
    side: randomInt(0, 1) === 0 ? "buy" : "sell",
    time: Date.now(),
  };
}

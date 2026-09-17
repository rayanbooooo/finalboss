/**
 * Rolling a live candle series forward.
 *
 * This lived in the price simulator, which is the only reason it looked like
 * simulation code. It is not: the real Bybit feed uses it on every ticker
 * message to advance the currently-forming bar, because `ticker` carries a
 * price but not a completed candle. The simulator is gone; this stays.
 */

import type { Candle } from "@/types/market";

/** Bars kept per series. Older ones fall off the front. */
const MAX_SERIES_BARS = 1200;

/**
 * Folds a price into the newest bar, or starts a new bar once the interval has
 * elapsed. Returns a new array - callers put it straight into React state.
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
    return rolled.length > MAX_SERIES_BARS
      ? rolled.slice(rolled.length - MAX_SERIES_BARS)
      : rolled;
  }

  const updated: Candle = {
    ...last,
    high: Math.max(last.high, price),
    low: Math.min(last.low, price),
    close: price,
  };

  return [...candles.slice(0, -1), updated];
}

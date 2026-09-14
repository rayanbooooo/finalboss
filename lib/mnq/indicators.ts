import type { Candle } from "@/types/market";

/**
 * True range of a bar, including the gap from the previous close.
 *
 * MNQ gaps across the 17:00–18:00 ET halt and over weekends, so high - low
 * alone understates overnight volatility badly enough to size positions wrong
 * on the Sunday open.
 */
export function trueRange(candle: Candle, previous: Candle | undefined): number {
  if (!previous) return candle.high - candle.low;
  return Math.max(
    candle.high - candle.low,
    Math.abs(candle.high - previous.close),
    Math.abs(candle.low - previous.close),
  );
}

/**
 * Wilder-smoothed ATR as a series, aligned index-for-index with `candles`.
 *
 * Returns NaN for bars before the first full period rather than a seeded
 * value, so callers cannot accidentally size a trade off an ATR built from
 * two bars of history.
 */
export function atrSeries(candles: Candle[], period = 14): number[] {
  const out = new Array<number>(candles.length).fill(NaN);
  if (candles.length < period + 1) return out;

  let sum = 0;
  for (let i = 1; i <= period; i++) sum += trueRange(candles[i], candles[i - 1]);
  let current = sum / period;
  out[period] = current;

  for (let i = period + 1; i < candles.length; i++) {
    current = (current * (period - 1) + trueRange(candles[i], candles[i - 1])) / period;
    out[i] = current;
  }

  return out;
}

/** ATR at the final bar, or NaN when there is not enough history. */
export function atr(candles: Candle[], period = 14): number {
  const series = atrSeries(candles, period);
  return series.at(-1) ?? NaN;
}

/** Body size as a fraction of the bar's full range. 1 is a marubozu. */
export function bodyRatio(candle: Candle): number {
  const range = candle.high - candle.low;
  if (range <= 0) return 0;
  return Math.abs(candle.close - candle.open) / range;
}

/**
 * Displacement: a bar whose body is both large relative to recent ATR and
 * mostly body rather than wick. This is what separates an institutional move
 * through a level from ordinary noise drifting through it.
 */
export function isDisplacement(candle: Candle, atrValue: number, minAtrMultiple = 1.2): boolean {
  if (!Number.isFinite(atrValue) || atrValue <= 0) return false;
  const body = Math.abs(candle.close - candle.open);
  return body >= atrValue * minAtrMultiple && bodyRatio(candle) >= 0.55;
}

import type { Candle } from "@/types/market";

export interface Timeframe {
  label: string;
  bucketMs: number;
}

export const TIMEFRAMES: Timeframe[] = [
  { label: "1m", bucketMs: 60_000 },
  { label: "5m", bucketMs: 5 * 60_000 },
  { label: "15m", bucketMs: 15 * 60_000 },
  { label: "1H", bucketMs: 60 * 60_000 },
  { label: "4H", bucketMs: 4 * 60 * 60_000 },
];

export const DEFAULT_TIMEFRAME = TIMEFRAMES[0];

/**
 * Resamples the underlying 1-minute-ish candle series into coarser bars for
 * display. Pure client-side aggregation of real (or honestly-labeled
 * simulated) data - no fabricated bars, and it works the same whether the
 * feed behind `candles` is live or the simulator fallback, since both
 * already share the same Candle shape and ascending time order.
 */
export function aggregateCandles(candles: Candle[], bucketMs: number): Candle[] {
  if (candles.length === 0) return [];

  const buckets = new Map<number, Candle>();
  const order: number[] = [];

  for (const candle of candles) {
    const bucketStart = Math.floor(candle.time / bucketMs) * bucketMs;
    const existing = buckets.get(bucketStart);
    if (!existing) {
      buckets.set(bucketStart, { ...candle, time: bucketStart });
      order.push(bucketStart);
    } else {
      existing.high = Math.max(existing.high, candle.high);
      existing.low = Math.min(existing.low, candle.low);
      existing.close = candle.close;
    }
  }

  return order.map((time) => buckets.get(time)!);
}

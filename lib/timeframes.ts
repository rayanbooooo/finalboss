import type { Candle } from "@/types/market";

export interface Timeframe {
  label: string;
  bucketMs: number;
  /** Which candle series (MarketSnapshot.candles vs .longRangeCandles) this
   * timeframe aggregates from - fine-grained minute bars can't show days of
   * real history, so 1H/4H source from the coarser, longer-history series. */
  source: "fine" | "coarse";
}

export const TIMEFRAMES: Timeframe[] = [
  { label: "1m", bucketMs: 60_000, source: "fine" },
  { label: "5m", bucketMs: 5 * 60_000, source: "fine" },
  { label: "15m", bucketMs: 15 * 60_000, source: "fine" },
  { label: "1H", bucketMs: 60 * 60_000, source: "coarse" },
  { label: "4H", bucketMs: 4 * 60 * 60_000, source: "coarse" },
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
      existing.volume += candle.volume;
    }
  }

  return order.map((time) => buckets.get(time)!);
}

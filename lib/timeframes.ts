/**
 * Coinbase Exchange accepts exactly these six candle granularities and nothing
 * else, and caps any single response at 300 buckets. Both facts shape the
 * timeframe list below: every timeframe maps to one native granularity and is
 * fetched at it directly.
 *
 * The alternative - resampling coarser bars out of the 1-minute series - is
 * what this replaced, and it could not show more history than the 1-minute
 * series held. 300 one-minute bars is five hours, so "15m" rendered twenty
 * bars of that same five hours rather than three days of real history.
 * Zooming out gave fewer bars, never more past.
 */
export const GRANULARITIES = [60, 300, 900, 3600, 21600, 86400] as const;

export type Granularity = (typeof GRANULARITIES)[number];

export interface Timeframe {
  label: string;
  /** Coinbase granularity in seconds; also the width of one bar. */
  granularity: Granularity;
}

/**
 * Span is 300 bars at the granularity, which is the API's per-response cap.
 * The 1-minute series is page-walked to twice that (see fetchHistoricalCandles)
 * because it is the default view and five hours is thin.
 */
export const TIMEFRAMES: Timeframe[] = [
  { label: "1m", granularity: 60 }, //     ~10 hours (2 pages)
  { label: "5m", granularity: 300 }, //     25 hours
  { label: "15m", granularity: 900 }, //   3.1 days
  { label: "1H", granularity: 3600 }, //  12.5 days
  { label: "6H", granularity: 21600 }, //   75 days
  { label: "1D", granularity: 86400 }, //  300 days
];

export const DEFAULT_TIMEFRAME = TIMEFRAMES[0];

/** The series every market keeps loaded: it backs the default chart view, the
 * landing-page sparklines and the 24h high/low, so it is never fetched lazily. */
export const BASE_GRANULARITY: Granularity = 60;

export function granularityMs(granularity: Granularity): number {
  return granularity * 1000;
}

/**
 * Bar widths in seconds. Each maps to one interval Bybit supports natively
 * (1 / 5 / 15 / 60 / 360 / D), so every timeframe is fetched at its own
 * granularity and nothing is resampled.
 *
 * That matters because resampling cannot invent history it was never given.
 * An earlier version built 5m and 15m out of the 1-minute series, and that
 * series was 300 bars - five hours - so "15m" rendered twenty bars of the same
 * five hours rather than days of real past. Zooming out gave fewer bars, never
 * more history.
 */
export const GRANULARITIES = [60, 300, 900, 3600, 21600, 86400] as const;

export type Granularity = (typeof GRANULARITIES)[number];

export interface Timeframe {
  label: string;
  /** Bar width in seconds; also what picks Bybit's `interval`. */
  granularity: Granularity;
}

/** Spans below are 1000 bars, Bybit's per-response cap - deep enough that no
 * timeframe needs a second request. */
export const TIMEFRAMES: Timeframe[] = [
  { label: "1m", granularity: 60 }, //    16.7 hours
  { label: "5m", granularity: 300 }, //    3.5 days
  { label: "15m", granularity: 900 }, //  10.4 days
  { label: "1H", granularity: 3600 }, //  41.7 days
  { label: "6H", granularity: 21600 }, // 250 days
  { label: "1D", granularity: 86400 }, //   2.7 years
];

export const DEFAULT_TIMEFRAME = TIMEFRAMES[0];

/** The series every market keeps loaded: it backs the default chart view, the
 * landing-page sparklines and the 24h high/low, so it is never fetched lazily. */
export const BASE_GRANULARITY: Granularity = 60;

export function granularityMs(granularity: Granularity): number {
  return granularity * 1000;
}

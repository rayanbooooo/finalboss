import type { Candle } from "@/types/market";

/**
 * Shared contract between the dashboard, the forecast route and the Kronos
 * sidecar.
 *
 * Kronos is generative rather than a point estimator: it samples whole future
 * K-line paths. Collapsing that to a single predicted close throws away the
 * only part a trader can act on, so the response carries a band and, more
 * usefully, the share of sampled paths that finished above the last close.
 * A directional bias with a confidence attached is something the setup scorer
 * can weigh; a single number is not.
 */

export interface ForecastRequest {
  /** Context window. Kronos-small takes 512 bars, mini takes 2048. */
  candles: Candle[];
  /** Bars ahead to predict. */
  horizon: number;
}

export interface ForecastResponse {
  /** False when no sidecar is configured or it could not be reached. */
  available: boolean;
  model: string;
  horizon: number;
  /** Median predicted close per step. Empty when unavailable. */
  median: number[];
  /** Upper and lower band, one entry per step. */
  upper: number[];
  lower: number[];
  /** Share of sampled paths whose final close exceeded the last real close. */
  probUp: number;
  /** Set when the forecast is missing or degraded, explaining why. */
  note?: string;
}

export const UNAVAILABLE_FORECAST: ForecastResponse = {
  available: false,
  model: "none",
  horizon: 0,
  median: [],
  upper: [],
  lower: [],
  probUp: 0.5,
  note: "No Kronos sidecar configured. Set KRONOS_SERVICE_URL to enable forecasts.",
};

/** Bars of context sent to the model. Matches Kronos-small's window. */
export const FORECAST_CONTEXT_BARS = 512;
export const FORECAST_HORIZON = 24;

/**
 * Turn a forecast into a directional bias the scanner can use.
 *
 * Deliberately conservative: anything between 45% and 55% is treated as no
 * information at all, because a foundation model that is 52% confident on
 * noisy intraday futures is not confident.
 */
export function forecastBias(forecast: ForecastResponse): "bullish" | "bearish" | "neutral" {
  if (!forecast.available) return "neutral";
  if (forecast.probUp >= 0.55) return "bullish";
  if (forecast.probUp <= 0.45) return "bearish";
  return "neutral";
}

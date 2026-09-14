"use client";

import { useQuery } from "@tanstack/react-query";
import type { Candle } from "@/types/market";
import {
  FORECAST_CONTEXT_BARS,
  FORECAST_HORIZON,
  UNAVAILABLE_FORECAST,
  type ForecastResponse,
} from "@/lib/mnq/forecast";

/**
 * Kronos forecast for the current bars.
 *
 * Refetched far less often than bars: a sampled forecast is expensive (it is
 * many autoregressive passes on a GPU) and its answer does not meaningfully
 * change bar to bar. Keyed on the last bar's timestamp so it recomputes once
 * per new bar at most, not on every re-render.
 */
export function useMnqForecast(candles: Candle[] | undefined) {
  const lastTime = candles && candles.length > 0 ? candles[candles.length - 1].time : null;

  const query = useQuery({
    queryKey: ["mnq-forecast", lastTime],
    enabled: Boolean(candles && candles.length >= 32),
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<ForecastResponse> => {
      const response = await fetch("/api/forecast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          candles: (candles ?? []).slice(-FORECAST_CONTEXT_BARS),
          horizon: FORECAST_HORIZON,
        }),
      });
      if (!response.ok) return { ...UNAVAILABLE_FORECAST, note: `Forecast route returned ${response.status}.` };
      return (await response.json()) as ForecastResponse;
    },
  });

  return { forecast: query.data ?? null, isLoading: query.isLoading };
}

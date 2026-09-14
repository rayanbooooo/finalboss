"use client";

import { useEffect, useState } from "react";
import { fetchInstrument } from "@/lib/liveMarketFeed";
import type { Instrument } from "@/lib/exchange/types";

/** Trading rules are static per symbol, so one fetch per (symbol, network)
 * serves the whole session. Module-level so switching markets back and forth
 * doesn't re-request. Only successful answers land here - caching a failure
 * would make one bad moment permanent. */
const cache = new Map<string, Instrument>();

/**
 * The venue's rules for one symbol: leverage bounds, quantity step, minimum
 * size.
 *
 * These decide what the exchange will accept, so they have to come from the
 * exchange. The demo constants describe a range no real venue offers - Bybit
 * caps BTC far below 1000x - and a leverage outside the venue's range gets the
 * order rejected rather than clamped.
 */
export function useInstrument(symbol: string | null, enabled: boolean): Instrument | null {
  const key = enabled && symbol ? symbol : null;

  // Keyed state rather than a setState in the effect: a cache hit has to be
  // reflected in the very first render for this key, and the switch between
  // markets must not leave the previous symbol's rules on screen.
  const [state, setState] = useState<{ key: string | null; instrument: Instrument | null }>({
    key: null,
    instrument: null,
  });
  if (state.key !== key) {
    setState({ key, instrument: key ? (cache.get(key) ?? null) : null });
  }

  useEffect(() => {
    if (!key || !symbol || cache.has(key)) return undefined;
    let cancelled = false;
    fetchInstrument(symbol)
      .then((result) => {
        if (result) cache.set(key, result);
        if (!cancelled && result) setState({ key, instrument: result });
      })
      .catch(() => {
        // Nothing is cached, so a later render retries. Leaving this unhandled
        // made a network blip an unhandled rejection instead of a retry.
      });
    return () => {
      cancelled = true;
    };
  }, [key, symbol]);

  return state.key === key ? state.instrument : null;
}

"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useMarketFeed } from "@/hooks/useMarketFeed";
import type { MarketSnapshot } from "@/types/market";

const MarketFeedContext = createContext<MarketSnapshot | null>(null);

export function MarketFeedProvider({ children }: { children: ReactNode }) {
  const market = useMarketFeed();
  return <MarketFeedContext.Provider value={market}>{children}</MarketFeedContext.Provider>;
}

export function useGlobalMarketFeed(): MarketSnapshot {
  const ctx = useContext(MarketFeedContext);
  if (!ctx) {
    throw new Error("useGlobalMarketFeed must be used within a MarketFeedProvider");
  }
  return ctx;
}

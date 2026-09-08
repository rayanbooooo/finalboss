"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useMultiMarketFeed } from "@/hooks/useMultiMarketFeed";
import type { MarketSnapshot } from "@/types/market";
import { DEFAULT_MARKET_ID, MARKETS, type MarketId } from "@/lib/markets";

interface MarketFeedContextValue {
  markets: Record<MarketId, MarketSnapshot>;
  activeMarketId: MarketId;
  setActiveMarketId: (id: MarketId) => void;
  activeMarket: MarketSnapshot;
}

const MarketFeedContext = createContext<MarketFeedContextValue | null>(null);

export function MarketFeedProvider({ children }: { children: ReactNode }) {
  const markets = useMultiMarketFeed();
  const [activeMarketId, setActiveMarketId] = useState<MarketId>(DEFAULT_MARKET_ID);

  return (
    <MarketFeedContext.Provider
      value={{ markets, activeMarketId, setActiveMarketId, activeMarket: markets[activeMarketId] }}
    >
      {children}
    </MarketFeedContext.Provider>
  );
}

export function useGlobalMarketFeed(): MarketFeedContextValue {
  const ctx = useContext(MarketFeedContext);
  if (!ctx) {
    throw new Error("useGlobalMarketFeed must be used within a MarketFeedProvider");
  }
  return ctx;
}

export { MARKETS };
export type { MarketId };

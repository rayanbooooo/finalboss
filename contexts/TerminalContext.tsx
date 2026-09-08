"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useGlobalMarketFeed } from "@/contexts/MarketFeedContext";
import { usePositions, type PositionWithPnl } from "@/hooks/usePositions";
import type { MarketSnapshot } from "@/types/market";
import type { ExecuteOrderParams, Position } from "@/types/trading";

interface TerminalContextValue {
  market: MarketSnapshot;
  openPositions: PositionWithPnl[];
  history: Position[];
  openPosition: (params: ExecuteOrderParams) => Position;
  closePosition: (id: string) => void;
}

const TerminalContext = createContext<TerminalContextValue | null>(null);

export function TerminalProvider({ children }: { children: ReactNode }) {
  const market = useGlobalMarketFeed();
  const { openPositions, history, open, close } = usePositions(market.price);

  const value: TerminalContextValue = {
    market,
    openPositions,
    history,
    openPosition: open,
    closePosition: close,
  };

  return <TerminalContext.Provider value={value}>{children}</TerminalContext.Provider>;
}

export function useTerminal(): TerminalContextValue {
  const ctx = useContext(TerminalContext);
  if (!ctx) {
    throw new Error("useTerminal must be used within a TerminalProvider");
  }
  return ctx;
}

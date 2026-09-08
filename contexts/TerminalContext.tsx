"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useGlobalMarketFeed } from "@/contexts/MarketFeedContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useToast } from "@/contexts/ToastContext";
import { formatCurrency, formatPrice } from "@/lib/format";
import { usePositions, type PositionWithPnl } from "@/hooks/usePositions";
import { useFunding, type FundingTransaction } from "@/hooks/useFunding";
import type { MarketSnapshot } from "@/types/market";
import type { ExecuteOrderParams, Position } from "@/types/trading";
import type { MarketId } from "@/lib/markets";

export type PositionsTab = "open" | "history";

interface TerminalContextValue {
  market: MarketSnapshot;
  markets: Record<MarketId, MarketSnapshot>;
  activeMarketId: MarketId;
  setActiveMarketId: (id: MarketId) => void;
  openPositions: PositionWithPnl[];
  history: Position[];
  openPosition: (params: ExecuteOrderParams) => Position;
  closePosition: (id: string) => void;
  positionsTab: PositionsTab;
  setPositionsTab: (tab: PositionsTab) => void;
  /** Demo funds only - no real money moves anywhere in this app. */
  availableBalance: number;
  /** Available funds plus margin locked in open positions and their unrealised P&L. */
  equity: number;
  lockedMargin: number;
  fundingHistory: FundingTransaction[];
  deposit: (amount: number) => void;
  withdraw: (amount: number) => void;
  fundingMode: FundingMode;
  openFunding: (mode: Exclude<FundingMode, null>) => void;
  closeFunding: () => void;
}

export type FundingMode = "deposit" | "withdraw" | null;

const TerminalContext = createContext<TerminalContextValue | null>(null);

export function TerminalProvider({ children }: { children: ReactNode }) {
  const { markets, activeMarketId, setActiveMarketId, activeMarket } = useGlobalMarketFeed();
  const { userId } = useOnboarding();
  const { openPositions, history, open, close } = usePositions(markets, userId);
  const { transactions, netFunding, deposit, withdraw } = useFunding(userId);
  const [positionsTab, setPositionsTab] = useState<PositionsTab>("open");
  const [fundingMode, setFundingMode] = useState<FundingMode>(null);
  const { toast } = useToast();

  // A liquidation happens on its own, with no click behind it - without this
  // a position could vanish and take the margin with it silently.
  const announcedRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    // First pass just records what already existed (restored from storage or
    // the database), so old liquidations don't announce themselves on load.
    if (announcedRef.current === null) {
      announcedRef.current = new Set(history.map((p) => p.id));
      return;
    }
    history.forEach((position) => {
      if (position.status !== "liquidated" || announcedRef.current!.has(position.id)) return;
      announcedRef.current!.add(position.id);
      toast({
        variant: "error",
        title: `${position.symbol} position liquidated`,
        description: `Liquidated at ${formatPrice(position.liquidationPrice)}. Margin of ${formatCurrency(position.margin)} was lost.`,
      });
    });
  }, [history, toast]);

  // Derived rather than stored: funding in, minus what's locked as margin,
  // plus whatever closed positions realised. A stored balance could drift
  // out of step with the history that produced it; this can't.
  const lockedMargin = openPositions.reduce((total, p) => total + p.margin, 0);
  const realisedPnl = history.reduce((total, p) => total + (p.realizedPnl ?? 0), 0);
  const unrealisedPnl = openPositions.reduce((total, p) => total + p.pnl, 0);
  const availableBalance = netFunding + realisedPnl - lockedMargin;
  const equity = availableBalance + lockedMargin + unrealisedPnl;

  const value: TerminalContextValue = {
    market: activeMarket,
    markets,
    activeMarketId,
    setActiveMarketId,
    openPositions,
    history,
    openPosition: open,
    closePosition: close,
    positionsTab,
    setPositionsTab,
    availableBalance,
    equity,
    lockedMargin,
    fundingHistory: transactions,
    deposit,
    withdraw,
    fundingMode,
    openFunding: setFundingMode,
    closeFunding: () => setFundingMode(null),
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

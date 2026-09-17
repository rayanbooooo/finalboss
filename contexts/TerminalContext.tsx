"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useGlobalMarketFeed } from "@/contexts/MarketFeedContext";
import { useExchange } from "@/contexts/ExchangeContext";
import { useLiveAccount } from "@/hooks/useLiveAccount";
import type { MarketSnapshot } from "@/types/market";
import type { Position, PositionWithPnl } from "@/types/trading";
import type { MarketId } from "@/lib/markets";

export type PositionsTab = "open" | "history";

/**
 * The terminal's account state.
 *
 * There is one account: the user's own, at the exchange. This context used to
 * carry two - a simulated one with invented funds and a real one - selected by
 * an `accountMode` flag that every panel had to branch on. The simulated half
 * is gone, and with it the whole class of bug where a screen showing one
 * account could be mistaken for the other.
 *
 * What replaces the demo balance is honesty about not having one: when the
 * venue's figures are unavailable the numbers are zero and `live` says why, so
 * a panel renders that state rather than a plausible-looking number.
 */
export interface LiveAccountStatus {
  /** An exchange account is connected. */
  active: boolean;
  /** Figures below are real and current. */
  ready: boolean;
  locked: boolean;
  loading: boolean;
  stale: boolean;
  error: string | null;
  fetchedAt: number | null;
  /** Re-polls the venue. Called straight after an order so the position table
   * reflects the fill without waiting out the poll interval. */
  refresh: () => void;
}

interface TerminalContextValue {
  market: MarketSnapshot;
  markets: Record<MarketId, MarketSnapshot>;
  activeMarketId: MarketId;
  setActiveMarketId: (id: MarketId) => void;
  openPositions: PositionWithPnl[];
  /**
   * Closed positions.
   *
   * Always empty for now: the venue's own order history is not yet read back,
   * and the alternative - keeping a local record of fills - would be a second
   * source of truth about money that could disagree with the exchange. An
   * empty history is wrong in a way the user can see; a divergent one is not.
   */
  history: Position[];
  positionsTab: PositionsTab;
  setPositionsTab: (tab: PositionsTab) => void;
  /** From the exchange. Zero when its figures are unavailable - see `live`. */
  availableBalance: number;
  equity: number;
  lockedMargin: number;
  live: LiveAccountStatus;
}

const TerminalContext = createContext<TerminalContextValue | null>(null);

export function TerminalProvider({ children }: { children: ReactNode }) {
  const { markets, activeMarketId, setActiveMarketId, activeMarket } = useGlobalMarketFeed();
  const [positionsTab, setPositionsTab] = useState<PositionsTab>("open");

  const { isConnected, isUnlocked } = useExchange();
  const liveAccount = useLiveAccount(isConnected);

  const live: LiveAccountStatus = {
    active: isConnected,
    ready: isConnected && isUnlocked && liveAccount.fetchedAt !== null,
    locked: isConnected && !isUnlocked,
    loading: liveAccount.loading,
    stale: liveAccount.stale,
    error: liveAccount.error,
    fetchedAt: liveAccount.fetchedAt,
    refresh: liveAccount.refresh,
  };

  // The venue is the only source. When its figures are not available these go
  // to zero and `live` explains why - they are never quietly replaced with
  // something that looks like a working account.
  const balance = liveAccount.balance;
  const positions = liveAccount.positions;

  const value: TerminalContextValue = {
    market: activeMarket,
    markets,
    activeMarketId,
    setActiveMarketId,
    openPositions: positions,
    history: [],
    positionsTab,
    setPositionsTab,
    availableBalance: balance?.availableBalance ?? 0,
    equity: balance?.totalEquity ?? 0,
    lockedMargin: positions.reduce((total, p) => total + p.margin, 0),
    live,
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

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useGlobalMarketFeed } from "@/contexts/MarketFeedContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useExchange } from "@/contexts/ExchangeContext";
import { useToast } from "@/contexts/ToastContext";
import { useLiveAccount } from "@/hooks/useLiveAccount";
import { formatCurrency, formatPrice } from "@/lib/format";
import { usePositions, type PositionWithPnl } from "@/hooks/usePositions";
import { useFunding, type FundingTransaction } from "@/hooks/useFunding";
import type { MarketSnapshot } from "@/types/market";
import type { ExecuteOrderParams, Position } from "@/types/trading";
import type { MarketId } from "@/lib/markets";
import { STORAGE_KEYS } from "@/lib/storageKeys";

export type PositionsTab = "open" | "history";

/**
 * Which account the terminal is showing. Deliberately NOT called "live" in the
 * UI: MarketHeader already says LIVE about the price feed, and overloading
 * that word on the one distinction that decides whether real money moves would
 * be the worst possible place for ambiguity.
 */
export type AccountMode = "demo" | "testnet" | "real";

const ACCOUNT_MODE_KEY = STORAGE_KEYS.accountMode;

export interface LiveAccountStatus {
  /** In a venue-backed mode (testnet or real). */
  active: boolean;
  /** Figures below are real and current. */
  ready: boolean;
  locked: boolean;
  loading: boolean;
  stale: boolean;
  error: string | null;
  fetchedAt: number | null;
}

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

  accountMode: AccountMode;
  /** Refuses a venue-backed mode when no exchange account is connected. */
  setAccountMode: (mode: AccountMode) => void;
  live: LiveAccountStatus;
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

  const { isConnected, isUnlocked, testnet } = useExchange();
  const [accountMode, setAccountModeState] = useState<AccountMode>("demo");
  // Restored after mount rather than in the initialiser, so the server and
  // client first render agree.
  const [restoredMode, setRestoredMode] = useState(false);
  useEffect(() => {
    if (restoredMode) return undefined;
    const raf = requestAnimationFrame(() => {
      try {
        const stored = window.localStorage.getItem(ACCOUNT_MODE_KEY);
        if (stored === "testnet" || stored === "real") setAccountModeState(stored);
      } catch {
        // Storage blocked: demo is the safe default anyway.
      }
      setRestoredMode(true);
    });
    return () => cancelAnimationFrame(raf);
  }, [restoredMode]);

  // A stored venue mode is meaningless once the key is gone, and leaving it
  // set would show an empty "live" account that looks like a real zero balance.
  //
  // The network check matters just as much. A mode restored from a previous
  // key is not validated against the current one, so a stored "real" alongside
  // a testnet key used to render the red REAL FUNDS badge over testnet data,
  // while the "Real funds" button sat simultaneously selected and disabled -
  // the exact state that reads as "I can't switch".
  const modeMatchesKey = accountMode === "demo" || (accountMode === "testnet") === testnet;
  const effectiveMode: AccountMode = isConnected && modeMatchesKey ? accountMode : "demo";
  const liveActive = effectiveMode !== "demo";

  const setAccountMode = useCallback(
    (mode: AccountMode) => {
      if (mode !== "demo" && !isConnected) return;
      if (mode !== "demo" && (mode === "testnet") !== testnet) return;
      setAccountModeState(mode);
      try {
        window.localStorage.setItem(ACCOUNT_MODE_KEY, mode);
      } catch {
        // Not persisting only means it resets to demo next visit.
      }
    },
    [isConnected, testnet]
  );

  const liveAccount = useLiveAccount(liveActive);

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
  const demoLockedMargin = openPositions.reduce((total, p) => total + p.margin, 0);
  const realisedPnl = history.reduce((total, p) => total + (p.realizedPnl ?? 0), 0);
  const demoUnrealisedPnl = openPositions.reduce((total, p) => total + p.pnl, 0);
  const demoAvailable = netFunding + realisedPnl - demoLockedMargin;
  const demoEquity = demoAvailable + demoLockedMargin + demoUnrealisedPnl;

  const live: LiveAccountStatus = {
    active: liveActive,
    ready: liveActive && isUnlocked && liveAccount.fetchedAt !== null,
    locked: liveActive && !isUnlocked,
    loading: liveAccount.loading,
    stale: liveAccount.stale,
    error: liveAccount.error,
    fetchedAt: liveAccount.fetchedAt,
  };

  // In a venue-backed mode the venue is the only source. When its figures
  // aren't available the numbers go to zero and `live` says why - panels render
  // that state instead of the numbers. They are never quietly replaced with
  // demo values, which would put a screen that looks like a real account in
  // front of someone whose real account it isn't.
  const balance = live.active ? liveAccount.balance : null;
  const availableBalance = live.active ? (balance?.availableBalance ?? 0) : demoAvailable;
  const equity = live.active ? (balance?.totalEquity ?? 0) : demoEquity;
  const livePositions = liveAccount.positions;
  const lockedMargin = live.active
    ? livePositions.reduce((total, p) => total + p.margin, 0)
    : demoLockedMargin;

  const value: TerminalContextValue = {
    market: activeMarket,
    markets,
    activeMarketId,
    setActiveMarketId,
    openPositions: live.active ? livePositions : openPositions,
    history: live.active ? [] : history,
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
    accountMode: effectiveMode,
    setAccountMode,
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

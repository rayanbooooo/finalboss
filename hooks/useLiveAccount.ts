"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useExchange } from "@/contexts/ExchangeContext";
import { parsePositions, parseWalletBalance, requests } from "@/lib/exchange/bybit";
import { send } from "@/lib/exchange/relay";
import type { LiveBalance, LivePosition } from "@/lib/exchange/types";
import type { PositionWithPnl } from "@/hooks/usePositions";
import { marketIdFromBybitSymbol, MARKETS } from "@/lib/markets";
import { calcPnlPercent } from "@/lib/calculations";

/**
 * A position's own fields only change when you trade, so 5s is plenty. The
 * figure that has to be live - the mark price - already is, from the market
 * feed. Bybit's private WebSocket would remove this poll but needs a separate
 * auth handshake; it is an optimisation, not a requirement.
 */
const POLL_MS = 5_000;
/** Beyond this, the panel says the figures are stale rather than presenting
 * them as current. */
export const STALE_AFTER_MS = 20_000;

export interface LiveAccountState {
  balance: LiveBalance | null;
  positions: PositionWithPnl[];
  /** Null until the first successful load. */
  fetchedAt: number | null;
  loading: boolean;
  error: string | null;
}

export interface LiveAccountResult extends LiveAccountState {
  /** Recomputed on each poll tick rather than at render: staleness that is
   * only evaluated when something happens to re-render would sit at "fresh"
   * for exactly as long as nothing else changed. */
  stale: boolean;
  refresh: () => void;
}

const EMPTY: LiveAccountState = {
  balance: null,
  positions: [],
  fetchedAt: null,
  loading: false,
  error: null,
};

/**
 * Turns a venue position into the shape the terminal's tables already render.
 *
 * Everything numeric here comes from Bybit rather than from lib/calculations:
 * the venue's own liquidation price and unrealised P&L are the real ones, and
 * recomputing them locally would show the user a number their exchange does
 * not agree with.
 */
export function toPositionWithPnl(position: LivePosition): PositionWithPnl {
  const marketId = marketIdFromBybitSymbol(position.symbol);
  const config = marketId ? MARKETS.find((m) => m.id === marketId) : undefined;

  return {
    id: `live:${position.symbol}:${position.side}`,
    marketId: marketId ?? "BTC",
    // Fall back to the venue's own symbol for a market we don't list, so an
    // unexpected position is still shown rather than silently mislabelled.
    symbol: config?.symbol ?? position.symbol,
    side: position.side,
    leverage: position.leverage,
    margin: position.margin,
    size: position.size,
    entryPrice: position.entryPrice,
    // Bybit omits this when a position cannot be liquidated. NaN rather than
    // 0 so it can never render as "liquidation at $0.00"; the tables check
    // Number.isFinite before showing it.
    liquidationPrice: position.liquidationPrice ?? Number.NaN,
    openedAt: position.openedAt,
    status: "open",
    markPrice: position.markPrice,
    pnl: position.unrealisedPnl,
    pnlPercent: calcPnlPercent(position.unrealisedPnl, position.margin),
  };
}

/**
 * Polls the connected exchange for balance and positions while a live mode is
 * active and unlocked.
 *
 * On a failed poll the last good snapshot is kept and the error surfaced,
 * rather than blanking the panel - but it is never replaced with demo figures.
 * A screen that looks like a real account and isn't is the one outcome worth
 * designing hardest against.
 */
export function useLiveAccount(active: boolean): LiveAccountResult {
  const { credentials, isUnlocked } = useExchange();
  const [state, setState] = useState<LiveAccountState>(EMPTY);
  const inFlight = useRef(false);
  const [nonce, setNonce] = useState(0);
  // Ticked by the poll so staleness is driven by the clock, not by renders.
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  const load = useCallback(async () => {
    const creds = credentials();
    if (!creds || inFlight.current) return;
    inFlight.current = true;
    setState((previous) => ({ ...previous, loading: true }));

    try {
      const [balanceResult, positionsResult] = await Promise.all([
        send<Record<string, unknown>>(await requests.walletBalance(creds)),
        send<Record<string, unknown>>(await requests.positions(creds)),
      ]);

      setState({
        balance: parseWalletBalance(balanceResult),
        positions: parsePositions(positionsResult).map(toPositionWithPnl),
        fetchedAt: Date.now(),
        loading: false,
        error: null,
      });
    } catch (caught) {
      // Keep whatever was last known good; only the error and loading flag move.
      setState((previous) => ({
        ...previous,
        loading: false,
        error: caught instanceof Error ? caught.message : "Could not reach the exchange.",
      }));
    } finally {
      inFlight.current = false;
    }
  }, [credentials]);

  useEffect(() => {
    if (!active || !isUnlocked) {
      // Deferred so the effect body never calls setState directly.
      const raf = requestAnimationFrame(() => setState(EMPTY));
      return () => cancelAnimationFrame(raf);
    }

    void load();
    const id = window.setInterval(() => {
      setTick(Date.now());
      void load();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [active, isUnlocked, load, nonce]);

  const stale = state.fetchedAt !== null && tick - state.fetchedAt > STALE_AFTER_MS;

  return { ...state, stale, refresh };
}

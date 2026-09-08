"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ExecuteOrderParams, Position } from "@/types/trading";
import type { MarketSnapshot } from "@/types/market";
import type { MarketId } from "@/lib/markets";
import {
  calcLiquidationPrice,
  calcPnl,
  calcPnlPercent,
  calcPositionSize,
} from "@/lib/calculations";
import { getSupabase, positionToRow, rowToPosition, type PositionRow } from "@/lib/supabase";

export interface PositionWithPnl extends Position {
  markPrice: number;
  pnl: number;
  pnlPercent: number;
}

const STORAGE_KEY = "finalboss:positions";
/** Open positions are always kept; only closed history is trimmed. */
const MAX_STORED_HISTORY = 200;

/**
 * Each position is marked against its own market's price (via
 * position.marketId), never against whichever market the UI currently has
 * selected - a BTC position must keep tracking BTC even while the terminal
 * is showing ETH.
 *
 * Signed in with Supabase configured, positions live in the database and
 * follow the account across devices. Otherwise they fall back to
 * localStorage, which is what a wallet-only or backend-less session gets.
 */
export function usePositions(markets: Record<MarketId, MarketSnapshot>, userId: string | null) {
  const [positions, setPositions] = useState<Position[]>([]);
  // Keyed by account rather than a plain boolean, so switching accounts
  // invalidates "restored" without a setState in the effect body.
  const [restoredFor, setRestoredFor] = useState<string | null>(null);
  const [prevMarkets, setPrevMarkets] = useState(markets);
  const marketsRef = useRef(markets);
  // id -> the status we last wrote to the database, so the sync effect can
  // tell an unsaved position from one that just changed status.
  const syncedRef = useRef(new Map<string, Position["status"]>());

  // Memoized so it's a stable effect dependency - rebuilding it every render
  // would re-fire the sync effect continuously.
  const remote = useMemo(() => {
    const supabase = getSupabase();
    return supabase && userId ? { supabase, userId } : null;
  }, [userId]);

  const storeKey = userId ?? "local";
  const restored = restoredFor === storeKey;

  useEffect(() => {
    marketsRef.current = markets;
  }, [markets]);

  // Read after mount (never during render) so the server-rendered HTML and
  // the hydration pass agree.
  useEffect(() => {
    let cancelled = false;
    syncedRef.current = new Map();

    if (remote) {
      void remote.supabase
        .from("positions")
        .select("*")
        .order("opened_at", { ascending: false })
        .then(({ data, error }) => {
          if (cancelled) return;
          if (error) {
            console.error("Could not load positions:", error.message);
          } else if (data) {
            const loaded = (data as PositionRow[]).map(rowToPosition);
            loaded.forEach((p) => syncedRef.current.set(p.id, p.status));
            setPositions(loaded);
          }
          setRestoredFor(storeKey);
        });
      return () => {
        cancelled = true;
      };
    }

    const raf = requestAnimationFrame(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        setPositions(raw ? (JSON.parse(raw) as Position[]) : []);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      setRestoredFor(storeKey);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [remote, storeKey]);

  // Gated on `restored` so the empty initial state can't overwrite stored
  // positions before the read above has run.
  useEffect(() => {
    if (!restored || remote) return;
    const open = positions.filter((p) => p.status === "open");
    const closed = positions.filter((p) => p.status !== "open").slice(0, MAX_STORED_HISTORY);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...open, ...closed]));
    } catch {
      // Storage full or blocked - the session still works from memory.
    }
  }, [positions, restored, remote]);

  // Write-through to the database. Covers opening, closing and liquidation
  // uniformly: anything whose status differs from what was last written gets
  // inserted or updated. The UI never waits on this.
  useEffect(() => {
    if (!restored || !remote) return;
    positions.forEach((position) => {
      const synced = syncedRef.current.get(position.id);
      if (synced === position.status) return;
      syncedRef.current.set(position.id, position.status);

      if (!synced) {
        void remote.supabase
          .from("positions")
          .insert(positionToRow(position, remote.userId))
          .then(({ error }) => {
            if (error) console.error("Could not save position:", error.message);
          });
        return;
      }

      void remote.supabase
        .from("positions")
        .update({
          status: position.status,
          closed_at: position.closedAt ? new Date(position.closedAt).toISOString() : null,
          close_price: position.closePrice ?? null,
          realized_pnl: position.realizedPnl ?? null,
        })
        .eq("id", position.id)
        .then(({ error }) => {
          if (error) console.error("Could not update position:", error.message);
        });
    });
  }, [positions, restored, remote]);

  const open = useCallback((params: ExecuteOrderParams) => {
    const size = calcPositionSize(params.margin, params.leverage, params.entryPrice);
    const liquidationPrice = calcLiquidationPrice(
      params.entryPrice,
      params.leverage,
      params.side
    );
    const position: Position = {
      // A uuid so the same id is valid as the database primary key.
      id: crypto.randomUUID(),
      marketId: params.marketId,
      symbol: params.symbol,
      side: params.side,
      leverage: params.leverage,
      margin: params.margin,
      size,
      entryPrice: params.entryPrice,
      liquidationPrice,
      openedAt: Date.now(),
      status: "open",
    };
    setPositions((prev) => [position, ...prev]);
    return position;
  }, []);

  const close = useCallback((id: string) => {
    setPositions((prev) =>
      prev.map((p) => {
        if (p.id !== id || p.status !== "open") return p;
        const markPrice = marketsRef.current[p.marketId]?.price ?? p.entryPrice;
        const pnl = calcPnl(p.entryPrice, markPrice, p.size, p.side);
        return {
          ...p,
          status: "closed",
          closedAt: Date.now(),
          closePrice: markPrice,
          realizedPnl: pnl,
        };
      })
    );
  }, []);

  if (markets !== prevMarkets) {
    setPrevMarkets(markets);
    setPositions((prev) => {
      let changed = false;
      const next = prev.map((p) => {
        if (p.status !== "open") return p;
        const markPrice = markets[p.marketId]?.price;
        if (markPrice === undefined) return p;
        const hit =
          p.side === "long" ? markPrice <= p.liquidationPrice : markPrice >= p.liquidationPrice;
        if (!hit) return p;
        changed = true;
        return {
          ...p,
          status: "liquidated" as const,
          closedAt: Date.now(),
          closePrice: p.liquidationPrice,
          // Derived from the price it actually liquidated at, so the close
          // price and the recorded loss agree. Hardcoding -margin claimed a
          // bigger loss than the stated close price implies.
          realizedPnl: calcPnl(p.entryPrice, p.liquidationPrice, p.size, p.side),
        };
      });
      return changed ? next : prev;
    });
  }

  const openPositions = useMemo<PositionWithPnl[]>(
    () =>
      positions
        .filter((p) => p.status === "open")
        .map((p) => {
          const markPrice = markets[p.marketId]?.price ?? p.entryPrice;
          const pnl = calcPnl(p.entryPrice, markPrice, p.size, p.side);
          return { ...p, markPrice, pnl, pnlPercent: calcPnlPercent(pnl, p.margin) };
        }),
    [positions, markets]
  );

  const history = useMemo(() => positions.filter((p) => p.status !== "open"), [positions]);

  return { openPositions, history, open, close };
}

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
import { generateId } from "@/lib/utils";

export interface PositionWithPnl extends Position {
  markPrice: number;
  pnl: number;
  pnlPercent: number;
}

/**
 * Each position is marked against its own market's price (via
 * position.marketId), never against whichever market the UI currently has
 * selected - a BTC position must keep tracking BTC even while the terminal
 * is showing ETH.
 */
export function usePositions(markets: Record<MarketId, MarketSnapshot>) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [prevMarkets, setPrevMarkets] = useState(markets);
  const marketsRef = useRef(markets);

  useEffect(() => {
    marketsRef.current = markets;
  }, [markets]);

  const open = useCallback((params: ExecuteOrderParams) => {
    const size = calcPositionSize(params.margin, params.leverage, params.entryPrice);
    const liquidationPrice = calcLiquidationPrice(
      params.entryPrice,
      params.leverage,
      params.side
    );
    const position: Position = {
      id: generateId("pos"),
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
          realizedPnl: -p.margin,
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

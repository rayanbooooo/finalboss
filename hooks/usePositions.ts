"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ExecuteOrderParams, Position } from "@/types/trading";
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

export function usePositions(markPrice: number) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [prevMarkPrice, setPrevMarkPrice] = useState(markPrice);
  const markPriceRef = useRef(markPrice);

  useEffect(() => {
    markPriceRef.current = markPrice;
  }, [markPrice]);

  const open = useCallback((params: ExecuteOrderParams) => {
    const size = calcPositionSize(params.margin, params.leverage, params.entryPrice);
    const liquidationPrice = calcLiquidationPrice(
      params.entryPrice,
      params.leverage,
      params.side
    );
    const position: Position = {
      id: generateId("pos"),
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
        const pnl = calcPnl(p.entryPrice, markPriceRef.current, p.size, p.side);
        return {
          ...p,
          status: "closed",
          closedAt: Date.now(),
          closePrice: markPriceRef.current,
          realizedPnl: pnl,
        };
      })
    );
  }, []);

  if (markPrice !== prevMarkPrice) {
    setPrevMarkPrice(markPrice);
    setPositions((prev) => {
      let changed = false;
      const next = prev.map((p) => {
        if (p.status !== "open") return p;
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
          const pnl = calcPnl(p.entryPrice, markPrice, p.size, p.side);
          return { ...p, markPrice, pnl, pnlPercent: calcPnlPercent(pnl, p.margin) };
        }),
    [positions, markPrice]
  );

  const history = useMemo(() => positions.filter((p) => p.status !== "open"), [positions]);

  return { openPositions, history, open, close };
}

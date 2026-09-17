import type { MarketId } from "@/lib/markets";

export type OrderSide = "long" | "short";

export type PositionStatus = "open" | "closed" | "liquidated";

export interface Position {
  id: string;
  marketId: MarketId;
  symbol: string;
  side: OrderSide;
  leverage: number;
  margin: number;
  size: number;
  entryPrice: number;
  liquidationPrice: number;
  openedAt: number;
  status: PositionStatus;
  closedAt?: number;
  closePrice?: number;
  realizedPnl?: number;
}

export interface ExecuteOrderParams {
  marketId: MarketId;
  symbol: string;
  side: OrderSide;
  leverage: number;
  margin: number;
  entryPrice: number;
}

/**
 * A position as the terminal's panels want it: the venue's record plus the
 * marked-to-market figures they display.
 *
 * It lived in the demo positions hook, which is where the simulated account
 * computed it. That hook is gone; the shape is not, because it is what the
 * position table, the chart overlay and the layout all read. `useLiveAccount`
 * derives it from what the exchange reports.
 */
export interface PositionWithPnl extends Position {
  markPrice: number;
  pnl: number;
  pnlPercent: number;
}

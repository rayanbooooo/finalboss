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

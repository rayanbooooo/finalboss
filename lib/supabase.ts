import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Position } from "@/types/trading";
import type { MarketId } from "@/lib/markets";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

let cached: SupabaseClient | null = null;

/**
 * Null until both NEXT_PUBLIC_SUPABASE_* vars are set. Every caller has to
 * handle that null: it's what lets the site keep running on localStorage
 * when the backend isn't configured (local dev, or a deploy before the env
 * vars are added) instead of crashing on a missing key.
 */
export function getSupabase(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  if (!cached) cached = createClient(url, anonKey);
  return cached;
}

export interface PositionRow {
  id: string;
  user_id: string;
  market_id: string;
  symbol: string;
  side: "long" | "short";
  leverage: number;
  margin: number;
  size: number;
  entry_price: number;
  liquidation_price: number;
  status: "open" | "closed" | "liquidated";
  opened_at: string;
  closed_at: string | null;
  close_price: number | null;
  realized_pnl: number | null;
}

/** Postgres timestamptz <-> the epoch-millisecond numbers the app uses. */
export function rowToPosition(row: PositionRow): Position {
  return {
    id: row.id,
    marketId: row.market_id as MarketId,
    symbol: row.symbol,
    side: row.side,
    leverage: row.leverage,
    margin: Number(row.margin),
    size: Number(row.size),
    entryPrice: Number(row.entry_price),
    liquidationPrice: Number(row.liquidation_price),
    status: row.status,
    openedAt: new Date(row.opened_at).getTime(),
    closedAt: row.closed_at ? new Date(row.closed_at).getTime() : undefined,
    closePrice: row.close_price === null ? undefined : Number(row.close_price),
    realizedPnl: row.realized_pnl === null ? undefined : Number(row.realized_pnl),
  };
}

export function positionToRow(position: Position, userId: string) {
  return {
    id: position.id,
    user_id: userId,
    market_id: position.marketId,
    symbol: position.symbol,
    side: position.side,
    leverage: position.leverage,
    margin: position.margin,
    size: position.size,
    entry_price: position.entryPrice,
    liquidation_price: position.liquidationPrice,
    status: position.status,
    opened_at: new Date(position.openedAt).toISOString(),
  };
}

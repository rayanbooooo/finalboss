import type { OrderSide } from "@/types/trading";

/** Only Bybit for now, but every shape below is venue-agnostic so a second
 * exchange is an adapter rather than a rewrite. */
export type Venue = "bybit";

export interface ExchangeCredentials {
  apiKey: string;
  apiSecret: string;
  testnet: boolean;
}

/**
 * What an API key is allowed to do, read back from the venue rather than
 * trusted from the user. `canWithdraw` is the one that matters: a key with
 * withdrawal rights is refused outright, so even a total compromise of this
 * app cannot move funds off the exchange.
 */
export interface KeyPermissions {
  canTrade: boolean;
  canWithdraw: boolean;
  readOnly: boolean;
  /** Bybit reports its own expiry; a key that has expired fails confusingly. */
  expiresAt: number | null;
}

export interface LiveBalance {
  coin: string;
  totalEquity: number;
  availableBalance: number;
  unrealisedPnl: number;
}

export interface LivePosition {
  symbol: string;
  side: OrderSide;
  size: number;
  entryPrice: number;
  markPrice: number;
  /** Bybit omits this when the position can't be liquidated (fully hedged, or
   * cross margin with ample equity), so it is genuinely optional. */
  liquidationPrice: number | null;
  leverage: number;
  margin: number;
  unrealisedPnl: number;
  openedAt: number;
}

/** Trading rules for one symbol. Leverage bounds come from here rather than
 * from a constant - they differ per symbol and per risk tier. */
export interface Instrument {
  symbol: string;
  minLeverage: number;
  maxLeverage: number;
  leverageStep: number;
  minQty: number;
  qtyStep: number;
  tickSize: number;
}

export interface PlaceOrderParams {
  symbol: string;
  side: OrderSide;
  qty: number;
  reduceOnly?: boolean;
}

/**
 * A request that has already been signed in the browser. The relay forwards
 * this verbatim - it never holds the secret, and it cannot alter the request
 * without invalidating the signature.
 */
export interface SignedRequest {
  testnet: boolean;
  method: "GET" | "POST";
  /** Path only, e.g. "/v5/account/wallet-balance". Never a full URL: the host
   * is chosen server-side from `testnet`, so a caller can't redirect it. */
  path: string;
  /** Query string without the leading "?". Empty for POST. */
  query: string;
  /** JSON body. Empty for GET. Must be byte-identical to what was signed. */
  body: string;
  headers: Record<string, string>;
}

export class ExchangeError extends Error {
  constructor(
    message: string,
    readonly code?: number | string,
    readonly httpStatus?: number
  ) {
    super(message);
    this.name = "ExchangeError";
  }
}

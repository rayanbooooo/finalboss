/**
 * The Aster endpoints this terminal calls.
 *
 * Every path and parameter below was read from Aster's published V3 reference
 * rather than inferred, because the cost of a wrong one is a request that looks
 * correct and fails at the venue with an error naming nothing. A previous
 * version of this file was written from a search-engine summary and pointed at
 * an endpoint that does not exist; this one cites where each fact came from.
 *
 * Signing lives in `signing.ts` and is not repeated here. What this module owns
 * is the shape of each call: its method, its path, and which parameters go in.
 */

import {
  buildAgentRequest,
  type AgentRequest,
  type AsterAgentAuth,
} from "@/lib/exchange/aster/signing";
import type { AsterNetwork } from "@/lib/exchange/aster/endpoints";
import type { OrderSide } from "@/types/trading";

/**
 * Paths, all verified against the V3 reference.
 *
 * `exchangeInfo` is the only unauthenticated one - Aster classes it
 * MARKET_DATA, so it needs no signature and no agent.
 */
export const ASTER_PATHS = {
  order: "/fapi/v3/order",
  balance: "/fapi/v3/balance",
  positionRisk: "/fapi/v3/positionRisk",
  leverage: "/fapi/v3/leverage",
  leverageBracket: "/fapi/v3/leverageBracket",
  exchangeInfo: "/fapi/v3/exchangeInfo",
  /** Registers the agent wallet and grants it permissions in one call. Aster
   *  treats it as unauthenticated - the wallet signature IS the authority. */
  registerAgent: "/fapi/v3/registerAndApproveAgent",
} as const;

export type AsterMethod = "GET" | "POST";

/**
 * A call ready for the relay: what to send, where, and the signed payload.
 *
 * The payload travels as a query string with `signature` appended, which is
 * what Aster's reference does for both GET and POST. Keeping the signed entries
 * attached means a caller transmits the same array that was signed and the two
 * cannot drift apart - the invariant the signing module exists to protect.
 */
export interface AsterCall {
  method: AsterMethod;
  path: string;
  request: AgentRequest;
}

/**
 * Aster speaks Binance's futures vocabulary - BUY and SELL, not long and short.
 *
 * The terminal says long/short everywhere else, so the translation happens here
 * instead of leaking venue vocabulary into the UI.
 */
export function asterSide(side: OrderSide): "BUY" | "SELL" {
  return side === "long" ? "BUY" : "SELL";
}

export interface AsterOrderParams {
  symbol: string;
  side: OrderSide;
  /** Already rounded to the symbol's step by the caller. */
  quantity: number;
  /** Closing orders set this so a mistimed close cannot open the other way. */
  reduceOnly?: boolean;
}

/**
 * A market order.
 *
 * `MARKET` requires `quantity` and nothing else, per the reference's table of
 * additional mandatory parameters by type.
 *
 * `reduceOnly` is documented as a STRING of "true" or "false" rather than a
 * boolean, and is omitted entirely when not set. Omitting rather than sending
 * "false" matters beyond tidiness: the signature covers every parameter
 * present, so an opening order that sends `reduceOnly=false` signs a different
 * string than one that omits it. Both are accepted, but only one of them
 * matches what Aster's own example produces, and matching the example is the
 * whole strategy for getting a first order accepted.
 */
export function orderCall(
  params: AsterOrderParams,
  auth: AsterAgentAuth,
  network: AsterNetwork
): AsterCall {
  const body: Record<string, string | number> = {
    symbol: params.symbol,
    side: asterSide(params.side),
    type: "MARKET",
    quantity: params.quantity,
  };
  if (params.reduceOnly) body.reduceOnly = "true";

  return {
    method: "POST",
    path: ASTER_PATHS.order,
    request: buildAgentRequest(body, auth, network),
  };
}

/** Closing is the opposite side, reduce-only. */
export function closeCall(
  symbol: string,
  side: OrderSide,
  quantity: number,
  auth: AsterAgentAuth,
  network: AsterNetwork
): AsterCall {
  return orderCall(
    { symbol, side: side === "long" ? "short" : "long", quantity, reduceOnly: true },
    auth,
    network
  );
}

/** Account balances. The reference documents no parameters beyond auth. */
export function balanceCall(auth: AsterAgentAuth, network: AsterNetwork): AsterCall {
  return {
    method: "GET",
    path: ASTER_PATHS.balance,
    request: buildAgentRequest({}, auth, network),
  };
}

/** Open positions. `symbol` is optional; omitting it returns every symbol,
 *  including ones with a zero position. */
export function positionRiskCall(
  auth: AsterAgentAuth,
  network: AsterNetwork,
  symbol?: string
): AsterCall {
  return {
    method: "GET",
    path: ASTER_PATHS.positionRisk,
    request: buildAgentRequest(symbol ? { symbol } : {}, auth, network),
  };
}

/**
 * Sets initial leverage for a symbol.
 *
 * The reference describes `leverage` as "int from 1 to 125". Treat that range
 * as unverified: Aster advertises far higher on some symbols, and the wording
 * is identical to Binance's, from whose API this one is derived - so it reads
 * like inherited documentation rather than Aster's own limit. The authoritative
 * answer per symbol is `leverageBracketCall` below, which is why the caller
 * should read that rather than hard-code a ceiling from this description.
 */
export function setLeverageCall(
  symbol: string,
  leverage: number,
  auth: AsterAgentAuth,
  network: AsterNetwork
): AsterCall {
  return {
    method: "POST",
    path: ASTER_PATHS.leverage,
    // Integer, not a decimal: the reference types it INT, and "10.0" is a
    // different signed string than "10".
    request: buildAgentRequest({ symbol, leverage: Math.trunc(leverage) }, auth, network),
  };
}

/**
 * The venue's real leverage ceiling for a symbol, by notional bracket.
 *
 * This is the only trustworthy source for what leverage an order may use. The
 * response carries an `initialLeverage` per bracket, and the maximum a position
 * may use falls as its notional rises, so a ceiling is a function of size and
 * not a constant.
 */
export function leverageBracketCall(
  auth: AsterAgentAuth,
  network: AsterNetwork,
  symbol?: string
): AsterCall {
  return {
    method: "GET",
    path: ASTER_PATHS.leverageBracket,
    request: buildAgentRequest(symbol ? { symbol } : {}, auth, network),
  };
}

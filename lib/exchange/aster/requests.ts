/**
 * The Aster requests this terminal sends, and where the builder fee is attached.
 *
 * This is the layer that was missing. `signing.ts` knows how to sign a request
 * and `builder.ts` knows what attribution to attach, but nothing built the
 * requests themselves - so the builder module had no callers and every routed
 * order earned nothing. Everything here exists to close that gap.
 *
 * WHAT IS VERIFIED, AND WHAT IS NOT
 *
 * Each path below carries its verification status, because the cost of a wrong
 * one is a request that looks correct and fails at the venue with an error that
 * points nowhere useful. Only endpoints confirmed against Aster's published V3
 * documentation appear here. The account-read endpoints - positions, balances,
 * leverage, instrument rules - are deliberately ABSENT rather than guessed;
 * they belong in a follow-up once their paths are confirmed, and a terminal
 * that cannot read a balance is obviously incomplete, which is a far better
 * failure than one that silently sends orders to a path that does not exist.
 */

import { attachBuilder, type BuilderConfig } from "@/lib/exchange/aster/builder";
import {
  buildAgentRequest,
  buildMainWalletRequest,
  type AgentRequest,
  type AsterAgentAuth,
  type AsterMainAuth,
  type MainWalletRequest,
} from "@/lib/exchange/aster/signing";
import type { AsterNetwork } from "@/lib/exchange/aster/endpoints";
import type { OrderSide } from "@/types/trading";

/**
 * Endpoint paths.
 *
 * `order` and `approveBuilder` are confirmed against Aster's V3 documentation.
 * `approveAgent` is the documented companion to `approveBuilder` and takes the
 * bundled builder parameters below, but its path has not been read verbatim -
 * confirm it before the approval flow ships.
 */
export const ASTER_PATHS = {
  /** VERIFIED. Accepts `builder` and `feeRate` as order parameters. */
  order: "/fapi/v3/order",
  /** VERIFIED. Sets the per-builder `maxFeeRate` ceiling. */
  approveBuilder: "/fapi/v3/approveBuilder",
  /** UNVERIFIED path. Parameters below are confirmed; the path is not. */
  approveAgent: "/fapi/v3/approveAgent",
} as const;

/**
 * Aster follows Binance's futures vocabulary: BUY and SELL, not long and short.
 *
 * The terminal speaks long/short everywhere else, so the translation happens
 * here rather than leaking venue vocabulary into the UI. Closing is the
 * opposite side plus `reduceOnly`, exactly as on Bybit.
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
 * Builds a signed market order carrying builder attribution.
 *
 * The builder parameters go in BEFORE signing and cannot be added afterwards:
 * on Aster `builder` and `feeRate` are order parameters, so they sit inside the
 * EIP-712 payload. This is the architectural difference from Bybit, where the
 * broker ID is a header the relay can add server-side. Here, if attribution is
 * not attached at this point, it can never be attached at all.
 *
 * A null builder produces an ordinary unattributed order rather than an error,
 * so an unconfigured deployment still trades - it just earns nothing, which is
 * the same degradation `attachBuilder` and the Bybit broker header both chose.
 */
export function buildOrderRequest(
  params: AsterOrderParams,
  builder: BuilderConfig | null,
  auth: AsterAgentAuth,
  network: AsterNetwork
): AgentRequest {
  const base: Record<string, string | number | boolean> = {
    symbol: params.symbol,
    side: asterSide(params.side),
    type: "MARKET",
    quantity: params.quantity,
  };

  // Only send reduceOnly when it is true. Aster's signature covers every
  // parameter present, and sending `reduceOnly=false` on an opening order is a
  // different signed payload than omitting it - harmless at the venue, but it
  // makes two logically identical orders hash differently, which is miserable
  // to debug against a reference implementation that omits it.
  if (params.reduceOnly) base.reduceOnly = true;

  return buildAgentRequest(attachBuilder(base, builder), auth, network);
}

/** Closing is the opposite side, reduce-only. Attribution still applies: the
 *  closing leg pays fees at the venue exactly as the opening one did. */
export function buildCloseRequest(
  symbol: string,
  side: OrderSide,
  quantity: number,
  builder: BuilderConfig | null,
  auth: AsterAgentAuth,
  network: AsterNetwork
): AgentRequest {
  return buildOrderRequest(
    {
      symbol,
      side: side === "long" ? "short" : "long",
      quantity,
      reduceOnly: true,
    },
    builder,
    auth,
    network
  );
}

/**
 * The one-time approval that makes a builder fee collectable.
 *
 * Aster rejects any order whose `feeRate` exceeds the `maxFeeRate` this call
 * established, so without it every attributed order fails. That makes this the
 * load-bearing step of the whole revenue path, not a nicety.
 *
 * Signed by the user's MAIN wallet, not the agent key - it is an authorisation
 * about money, and `buildMainWalletRequest` signs it under chain 56 for exactly
 * that reason (see endpoints.ts).
 *
 * `primaryType` must be "ApproveBuilder": it is the EIP-712 type name and is
 * not derivable from the path, and a wrong one recovers to a different address
 * and reads like a permissions failure rather than a signing one.
 */
export function buildApproveBuilderRequest(
  builder: BuilderConfig,
  maxFeeRate: string,
  auth: AsterMainAuth,
  network: AsterNetwork
): MainWalletRequest {
  return buildMainWalletRequest(
    { builder: builder.address, maxFeeRate },
    auth,
    network,
    "ApproveBuilder"
  );
}

export interface AgentApproval {
  agentName: string;
  agentAddress: string;
  /** Unix seconds. Aster expires agent authority rather than leaving it open. */
  expired: number;
}

/**
 * Approves the trading agent, optionally approving the builder in the same
 * signature.
 *
 * Bundling matters for conversion, not just tidiness. Approving separately
 * means two wallet prompts before a user's first trade, and the second one -
 * arriving after they think they are set up - is where people stop. Aster
 * documents `builder`, `feeRate` and `maxFeeRate` as optional parameters of the
 * agent approval precisely so this can be one prompt.
 *
 * Passing no builder yields a plain agent approval, so the flow still works on
 * a deployment with no builder configured.
 */
export function buildApproveAgentRequest(
  approval: AgentApproval,
  builder: BuilderConfig | null,
  maxFeeRate: string | null,
  auth: AsterMainAuth,
  network: AsterNetwork
): MainWalletRequest {
  const params: Record<string, string | number | boolean> = {
    agentName: approval.agentName,
    agentAddress: approval.agentAddress,
    expired: approval.expired,
  };

  // Both halves or neither. A builder address with no ceiling would be approved
  // at whatever Aster defaults, and a ceiling with no address authorises
  // nobody - the same partial-configuration trap readBuilderConfig refuses.
  if (builder !== null && maxFeeRate !== null) {
    params.builder = builder.address;
    params.feeRate = builder.feeRate;
    params.maxFeeRate = maxFeeRate;
  }

  return buildMainWalletRequest(params, auth, network, "ApproveAgent");
}

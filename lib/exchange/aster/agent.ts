/**
 * The one-time authorisation that lets this terminal trade an Aster account.
 *
 * Aster's model separates the wallet that OWNS the funds from the wallet that
 * SIGNS orders. The owner signs a single approval naming a delegated "agent"
 * wallet and the permissions it may use; from then on the agent signs every
 * order, and the owner's wallet is never asked again.
 *
 * That separation is why this terminal can trade an account without ever being
 * able to drain it - and it only holds if the permissions below stay as they
 * are, which is why two of them are not parameters.
 */

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import { buildRegisterAgentRequest, type MainWalletRequest } from "@/lib/exchange/aster/signing";

/** Shown in Aster's own API management list, so the user can see which app an
 *  approval belongs to and revoke it without guessing. */
export const AGENT_NAME = "FinalBoss";

/**
 * How long an approval lasts before Aster expires it.
 *
 * Ninety days rather than the maximum on offer. An agent key lives in a
 * browser, and a browser is the least defensible place a key can live, so the
 * authorisation should lapse on its own if the user never returns. Re-approving
 * is one wallet signature; an indefinitely valid key on an abandoned laptop is
 * not recoverable by anyone.
 */
export const APPROVAL_DAYS = 90;

export interface AgentWallet {
  address: `0x${string}`;
  /**
   * Never leaves the browser, never reaches our server, and is stored only
   * under the user's own passphrase via `lib/exchange/crypto.ts`.
   */
  privateKey: `0x${string}`;
}

/**
 * Generates a fresh agent wallet.
 *
 * Fresh, rather than reusing the user's own wallet as its own agent, which
 * Aster's UI permits. Reuse would mean the key that signs orders is also the
 * key that holds the funds, collapsing the separation the whole design rests
 * on: a leak of the trading key would then be a leak of everything.
 */
export function createAgentWallet(): AgentWallet {
  const privateKey = generatePrivateKey();
  return { address: privateKeyToAccount(privateKey).address, privateKey };
}

export interface ApprovalParams {
  /** The wallet that owns the funds, from the connected browser wallet. */
  user: string;
  /** The delegated wallet from `createAgentWallet`. */
  agentAddress: string;
  nonce: number;
  /** Milliseconds since epoch. Defaults to APPROVAL_DAYS from now. */
  expiresAt?: number;
}

export function defaultExpiry(now: number = Date.now()): number {
  return now + APPROVAL_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Builds the approval for the user's wallet to sign.
 *
 * THE PERMISSIONS ARE NOT PARAMETERS, and that is deliberate.
 *
 * `canWithdraw` is false and cannot be set. A key that can move funds is the
 * one thing this terminal must never hold: without it, the worst a total
 * compromise achieves is unwanted trades on an account; with it, the worst is
 * that the money is gone. Aster also requires an IP allowlist alongside
 * withdrawal rights, which a browser cannot honestly provide. Making it an
 * argument would mean some future caller could pass true, so there is no
 * argument to pass. The same reasoning already governs the Bybit path, where a
 * key reporting withdrawal rights is refused at connection time.
 *
 * `canSpotTrade` is false for a narrower reason: this is a perpetuals terminal
 * and it never places a spot order, so granting spot access would widen what a
 * leaked key could do in exchange for nothing at all.
 */
export function buildApproval(params: ApprovalParams): MainWalletRequest {
  return buildRegisterAgentRequest({
    user: params.user,
    nonce: params.nonce,
    agentName: AGENT_NAME,
    agentAddress: params.agentAddress,
    expired: params.expiresAt ?? defaultExpiry(),
    canSpotTrade: false,
    canPerpTrade: true,
    canWithdraw: false,
    // Required and non-empty only when canWithdraw is true, which it never is.
    ipWhitelist: "",
  });
}

/**
 * The query string for the approval request, once the wallet has signed it.
 *
 * The signature is appended to the payload that was signed rather than mixed
 * into it - Aster's reference does exactly this, and rebuilding the payload
 * here instead of reusing `payloadString` would risk transmitting a string that
 * differs by a byte from the one that was signed.
 */
export function approvalQuery(request: MainWalletRequest, signature: string): string {
  return `${request.payloadString}&signature=${signature}`;
}

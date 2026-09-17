/**
 * Signing an Aster call in the browser and sending it.
 *
 * This is the only place the agent's private key exists in plaintext, and it
 * exists there for the length of one function call. It is decrypted by the
 * caller from the user's passphrase, passed in, used once, and never stored,
 * logged or sent anywhere - the relay forwards a signature, never a key.
 *
 * Kept apart from `requests.ts`, which builds calls and touches no key at all,
 * so the module that knows what an order looks like can be read and tested
 * without going anywhere near signing.
 */

import { privateKeyToAccount } from "viem/accounts";

import { sendAster } from "@/lib/exchange/relay";
import { closeCall, orderCall, type AsterCall, type AsterOrderParams } from "@/lib/exchange/aster/requests";
import { nextNonce, type AsterAgentAuth } from "@/lib/exchange/aster/signing";
import type { AsterNetwork } from "@/lib/exchange/aster/endpoints";
import type { OrderSide } from "@/types/trading";

/** What the caller must have to place an order: an approved agent and its key. */
export interface AgentCredentials {
  /** The delegated wallet Aster has on file. */
  signer: string;
  /** Decrypted immediately before the call and discarded after it. */
  privateKey: `0x${string}`;
  network: AsterNetwork;
}

/**
 * Signs a call and sends it through the relay.
 *
 * The signature is appended to the payload string the call already produced,
 * never to a rebuilt one. Rebuilding risks transmitting a string that differs
 * by a byte from the one that was signed, which Aster rejects as a bad
 * signature and which is close to impossible to spot by reading either string.
 */
export async function executeAsterCall<T = unknown>(
  call: AsterCall,
  credentials: AgentCredentials
): Promise<T> {
  const account = privateKeyToAccount(credentials.privateKey);

  const signature = await account.signTypedData({
    domain: call.request.typedData.domain,
    types: { Message: call.request.typedData.types.Message },
    primaryType: "Message",
    message: call.request.typedData.message as { msg: string },
  });

  return sendAster<T>({
    method: call.method,
    path: call.path,
    query: `${call.request.payloadString}&signature=${signature}`,
    testnet: credentials.network === "testnet",
  });
}

function authFor(credentials: AgentCredentials): AsterAgentAuth {
  // `user` is deliberately absent. Aster's own order example sends `signer`
  // alone, and a live request confirmed it: adding `user` changes the signed
  // string for no gain.
  return { signer: credentials.signer, nonce: nextNonce() };
}

/** Opens a position with a market order. */
export async function placeAsterOrder(
  params: AsterOrderParams,
  credentials: AgentCredentials
): Promise<unknown> {
  return executeAsterCall(
    orderCall(params, authFor(credentials), credentials.network),
    credentials
  );
}

/**
 * Closes a position with a reduce-only market order on the opposite side.
 *
 * reduceOnly is what makes this safe to send twice: without it, a close that
 * races a fill opens a position the other way instead of flattening this one.
 */
export async function closeAsterPosition(
  symbol: string,
  side: OrderSide,
  quantity: number,
  credentials: AgentCredentials
): Promise<unknown> {
  return executeAsterCall(
    closeCall(symbol, side, quantity, authFor(credentials), credentials.network),
    credentials
  );
}

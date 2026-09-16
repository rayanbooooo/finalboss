/**
 * Aster V3 request signing.
 *
 * Aster uses two DIFFERENT EIP-712 schemes depending on who is signing, and
 * they are not interchangeable:
 *
 * - **Agent requests** (placing orders, reading your own account) are signed by
 *   a delegated API wallet using a fixed `Message(string msg)` type, where the
 *   message is the encoded parameter string. The signature rides in the query
 *   string.
 *
 * - **Main-wallet requests** (`registerAndApproveAgent`) are signed by the
 *   user's actual wallet. They use the SAME flat `Message(string msg)` type -
 *   what differs is the chainId (56, the chain the wallet lives on, not the
 *   network's) and a field order fixed by the endpoint rather than the caller.
 *
 * This module builds the payloads and the typed data. It never touches a
 * private key: agent signing is done with a key the browser holds, and
 * main-wallet signing goes through the connected wallet. Keeping key handling
 * out means every rule below can be unit-tested against Aster's own reference
 * vectors.
 *
 * THE INVARIANT, and the one that bites: the string that is signed and the
 * string that is transmitted must be byte-identical. So these builders return
 * the ordered entries alongside the signing string - callers transmit from the
 * same array they signed, and the two cannot drift apart.
 *
 * Whether that order is insertion or sorted is genuinely unsettled in Aster's
 * own documentation; see `SORT_KEYS_ASCII` below, which is where that question
 * is recorded and where it gets answered by the first live request.
 */

import { SIGNATURE_CHAIN_ID, asterNetwork, type AsterNetwork } from "./endpoints";

/** Values Aster accepts as a parameter before serialisation. */
export type AsterParamValue = string | number | boolean;

export type AsterParams = Record<string, AsterParamValue | null | undefined>;

/** One `key=value` pair, already serialised, in the order it must be sent. */
export type AsterEntry = readonly [string, string];

export interface AsterAgentAuth {
  /**
   * The main wallet that owns the funds.
   *
   * Optional, and that is Aster's rule rather than a convenience: its auth
   * table gives `signer` for API-wallet authentication and `user` for
   * master-account authentication, and its two worked examples differ to
   * match - a plain order sends signer alone, a master-account read sends
   * both. Sending `user` where it is not wanted changes the signed string and
   * yields a signature error that names nothing.
   */
  user?: string;
  /** The delegated API wallet that signs. */
  signer: string;
  nonce: number;
}

export interface AsterMainAuth {
  user: string;
  nonce: number;
}

/** EIP-712 typed data, shaped for viem's `signTypedData`. */
export interface TypedData {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: `0x${string}`;
  };
  types: Record<string, { name: string; type: string }[]>;
  primaryType: string;
  message: Record<string, AsterParamValue>;
}

const DOMAIN_NAME = "AsterSignTransaction";
const DOMAIN_VERSION = "1";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

const EIP712_DOMAIN_FIELDS = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "chainId", type: "uint256" },
  { name: "verifyingContract", type: "address" },
];

/**
 * Monotonic microsecond nonce, for replay protection.
 *
 * `Date.now() * 1000` is ~1.8e15, comfortably inside Number.MAX_SAFE_INTEGER
 * (9.0e15), so plain numbers are safe here for roughly the next two centuries.
 * The counter only breaks ties inside a single millisecond; without it, two
 * orders placed in the same tick collide and the second is rejected as a
 * replay.
 */
let lastNonceMs = 0;
let nonceCounter = 0;

export function nextNonce(now: number = Date.now()): number {
  if (now === lastNonceMs) {
    nonceCounter += 1;
  } else {
    lastNonceMs = now;
    nonceCounter = 0;
  }
  return now * 1000 + nonceCounter;
}

/**
 * Whether the signed parameters are sorted by key.
 *
 * ASTER'S OWN DOCUMENTATION DISAGREES WITH ITSELF HERE, and this constant
 * exists so that the disagreement is visible and one line to settle rather than
 * a day spent inside a signature error.
 *
 * "Aster API Overview.md" describes the V3 signing flow as "sort them by ASCII
 * key order", and names "incorrect parameter sorting" as the most common
 * migration failure. But the runnable Python example in the V3 reference builds
 * its payload with `urllib.parse.urlencode(my_dict)` over a dict whose literal
 * order is symbol, type, side, timeInForce, quantity, price - which is not
 * sorted, by inspection.
 *
 * False, because executable code that someone ran beats prose that reads like
 * it was written once and left: the same overview also lists `timestamp` as a
 * V3 parameter and implies `user` is always required, and the example sends
 * neither. Three claims, one source, all contradicted by the code.
 *
 * If the first live request comes back with a signature error and nothing else
 * explains it, flip this to true before changing anything else. That is the
 * single most likely cause, and the test below covers both behaviours so the
 * flip cannot break anything silently.
 */
export const SORT_KEYS_ASCII = false;

/** Drops null/undefined and stringifies the rest, matching Aster's reference
 *  serialisation (booleans become "true"/"false", numbers their decimal form). */
function serialise(params: AsterParams): AsterEntry[] {
  const entries: AsterEntry[] = [];
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    entries.push([key, String(value)]);
  });
  return SORT_KEYS_ASCII
    ? [...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    : entries;
}

/**
 * Joins entries as `k=v&k=v`, percent-encoded.
 *
 * This matches `urllib.parse.urlencode`, which is what Aster's reference
 * implementation signs. The comment that stood here claimed the opposite and
 * joined raw. For the parameters this terminal actually sends - symbols,
 * decimal quantities, 0x addresses, booleans - raw and encoded are
 * byte-identical, so the mistake was invisible; it would have surfaced the
 * first time a value contained a character needing an escape, as a signature
 * error pointing nowhere.
 *
 * Hand-rolled rather than `URLSearchParams` because the two disagree on the
 * safe set - notably `~`, which Python leaves alone and URLSearchParams
 * escapes. The set below is Python's `quote_plus`, because Python is what
 * Aster's reference was written in.
 */
const QUOTE_PLUS_SAFE = /[A-Za-z0-9_.\-~]/;

function quotePlus(value: string): string {
  let out = "";
  for (const char of value) {
    if (QUOTE_PLUS_SAFE.test(char)) {
      out += char;
    } else if (char === " ") {
      out += "+";
    } else {
      for (const byte of new TextEncoder().encode(char)) {
        out += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
      }
    }
  }
  return out;
}

export function encodeEntries(entries: readonly AsterEntry[]): string {
  return entries.map(([key, value]) => `${quotePlus(key)}=${quotePlus(value)}`).join("&");
}

export interface AgentRequest {
  entries: AsterEntry[];
  /** Exactly what must be signed, and what must be transmitted. */
  payloadString: string;
  typedData: TypedData;
}

/**
 * Builds an agent-signed request: an order, or a read of your own account.
 *
 * Parameter order follows Aster's reference implementation exactly - the
 * caller's own parameters first, then `nonce`, then `user` where the endpoint
 * requires master-account auth, then `signer`.
 */
export function buildAgentRequest(
  params: AsterParams,
  auth: AsterAgentAuth,
  network: AsterNetwork
): AgentRequest {
  const config = asterNetwork(network);
  // `serialise` drops an absent `user`, so both documented shapes - order
  // (signer alone) and master-account read (user and signer) - fall out of one
  // expression with the order preserved.
  //
  // There is no `asterChain`. That parameter appears nowhere in any of Aster's
  // documentation - not the V3 reference, the testnet reference, the V1 docs,
  // the chain docs or the Chinese editions - yet it was being inserted into
  // every signed string this module produced.
  const entries = serialise({
    ...params,
    nonce: auth.nonce,
    user: auth.user,
    signer: auth.signer,
  });
  const payloadString = encodeEntries(entries);

  return {
    entries,
    payloadString,
    typedData: {
      domain: {
        name: DOMAIN_NAME,
        version: DOMAIN_VERSION,
        chainId: config.chainId,
        verifyingContract: ZERO_ADDRESS,
      },
      types: {
        EIP712Domain: EIP712_DOMAIN_FIELDS,
        Message: [{ name: "msg", type: "string" }],
      },
      primaryType: "Message",
      message: { msg: payloadString },
    },
  };
}

/**
 * Infers the EIP-712 field type from the value, mirroring Aster's reference
 * implementation.
 *
 * Booleans are checked first on purpose: in Python `bool` is a subclass of
 * `int`, so their check order is load-bearing and ours has to match it or a
 * `canWithdraw: false` would be typed `uint256` and hash differently.
 *
 * Note that only INTEGERS become `uint256`. A fractional number - a fee rate,
 * say - is a `string`, which is why `maxFeeRate` is passed as "0.00001" rather
 * than 0.00001.
 */
export function inferFieldType(value: AsterParamValue): "bool" | "uint256" | "string" {
  if (typeof value === "boolean") return "bool";
  if (typeof value === "number" && Number.isInteger(value)) return "uint256";
  return "string";
}

export interface MainWalletRequest {
  /** Body parameters, in send order. */
  entries: AsterEntry[];
  /** Exactly what is signed, and what must be transmitted. */
  payloadString: string;
  typedData: TypedData;
  /** Sent alongside the signature so Aster knows which chain to recover on. */
  signatureChainId: number;
}

export interface RegisterAgentParams {
  /** The main wallet that owns the funds. */
  user: string;
  nonce: number;
  agentName: string;
  /** The delegated API wallet this authorises. */
  agentAddress: string;
  /** Milliseconds. Aster expires agent authority rather than leaving it open. */
  expired: number;
  canSpotTrade: boolean;
  canPerpTrade: boolean;
  canWithdraw: boolean;
  /**
   * Space-separated addresses or CIDR ranges. Required and non-empty whenever
   * `canWithdraw` is true - which this terminal never sets, because a key that
   * can move funds is the one thing it refuses to hold.
   */
  ipWhitelist: string;
}

/**
 * Builds `POST /fapi/v3/registerAndApproveAgent`.
 *
 * This replaced a generic main-wallet builder that produced the wrong shape.
 * That one derived an EIP-712 type from the parameters - a field per parameter,
 * names capitalised, types inferred - which is not what Aster documents. Every
 * signed request on Aster, agent and main wallet alike, uses the SAME flat
 * `Message(string msg)` type; only the chainId and the field order change. A
 * per-field type hashes to something entirely different and recovers to the
 * wrong address, which surfaces as an authorisation failure rather than a
 * signing one, and sends you looking in the wrong place.
 *
 * The field order below is fixed by Aster's documented message template and is
 * NOT the caller's to vary, which is why this takes named parameters rather
 * than a bag: with a bag, a caller reordering their object would silently
 * produce an invalid signature.
 *
 * `domain.chainId` is `signatureChainId` (56 for EVM), never the network's
 * 1666 - the docs call this out explicitly, and it is the same distinction
 * `SIGNATURE_CHAIN_ID` exists to record.
 */
export function buildRegisterAgentRequest(
  params: RegisterAgentParams
): MainWalletRequest {
  const entries = serialise({
    user: params.user,
    nonce: params.nonce,
    agentName: params.agentName,
    agentAddress: params.agentAddress,
    expired: params.expired,
    signatureChainId: SIGNATURE_CHAIN_ID,
    canSpotTrade: params.canSpotTrade,
    canPerpTrade: params.canPerpTrade,
    canWithdraw: params.canWithdraw,
    ipWhitelist: params.ipWhitelist,
  });

  const payloadString = encodeEntries(entries);

  return {
    entries,
    payloadString,
    signatureChainId: SIGNATURE_CHAIN_ID,
    typedData: {
      domain: {
        name: DOMAIN_NAME,
        version: DOMAIN_VERSION,
        chainId: SIGNATURE_CHAIN_ID,
        verifyingContract: ZERO_ADDRESS,
      },
      types: {
        EIP712Domain: EIP712_DOMAIN_FIELDS,
        Message: [{ name: "msg", type: "string" }],
      },
      primaryType: "Message",
      message: { msg: payloadString },
    },
  };
}

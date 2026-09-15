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
 * - **Main-wallet requests** (`approveAgent`, `approveBuilder`) are signed by
 *   the user's actual wallet using a type generated from the parameters
 *   themselves - a different primary type per endpoint, with field types
 *   inferred from the values. The signature rides in the body.
 *
 * This module builds the payloads and the typed data. It never touches a
 * private key: agent signing is done with a key the browser holds, and
 * main-wallet signing goes through the connected wallet. Keeping key handling
 * out means every rule below can be unit-tested against Aster's own reference
 * vectors.
 *
 * THE INVARIANT, and the one that bites: the string that is signed and the
 * string that is transmitted must be byte-identical. Aster's reference
 * implementation relies on insertion order, not sorted keys, so these builders
 * return the ordered entries alongside the signing string - callers transmit
 * from the same array they signed, and cannot drift apart.
 */

import { SIGNATURE_CHAIN_ID, asterNetwork, type AsterNetwork } from "./endpoints";

/** Values Aster accepts as a parameter before serialisation. */
export type AsterParamValue = string | number | boolean;

export type AsterParams = Record<string, AsterParamValue | null | undefined>;

/** One `key=value` pair, already serialised, in the order it must be sent. */
export type AsterEntry = readonly [string, string];

export interface AsterAgentAuth {
  /** The main wallet that owns the funds. */
  user: string;
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

/** Drops null/undefined and stringifies the rest, matching Aster's reference
 *  serialisation (booleans become "true"/"false", numbers their decimal form). */
function serialise(params: AsterParams): AsterEntry[] {
  const entries: AsterEntry[] = [];
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    entries.push([key, String(value)]);
  });
  return entries;
}

/**
 * Joins entries as `k=v&k=v`.
 *
 * Deliberately NOT `URLSearchParams`: it percent-encodes, and Aster's reference
 * implementation signs the raw joined string. Signing an encoded string and
 * sending a raw one (or the reverse) fails with a signature error that gives no
 * hint which side is wrong.
 */
export function encodeEntries(entries: readonly AsterEntry[]): string {
  return entries.map(([key, value]) => `${key}=${value}`).join("&");
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
 * caller's own parameters first, then `asterChain`, `user`, `signer`, `nonce`.
 */
export function buildAgentRequest(
  params: AsterParams,
  auth: AsterAgentAuth,
  network: AsterNetwork
): AgentRequest {
  const config = asterNetwork(network);
  const entries = serialise({
    ...params,
    asterChain: config.asterChain,
    user: auth.user,
    signer: auth.signer,
    nonce: auth.nonce,
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

/** Aster capitalises the first letter of every parameter name when building
 *  the message type, while the wire parameters stay lower-cased. */
function capitalise(key: string): string {
  return key.length === 0 ? key : `${key[0].toUpperCase()}${key.slice(1)}`;
}

export interface MainWalletRequest {
  /** Body parameters, lower-cased keys, in send order. */
  entries: AsterEntry[];
  typedData: TypedData;
  /** Sent alongside the signature so Aster knows which chain to recover on. */
  signatureChainId: number;
}

/**
 * Builds a main-wallet-signed request: `approveAgent`, `approveBuilder`, and
 * the other authorisations only the fund-owning wallet may make.
 *
 * `primaryType` is the endpoint's own type name - "ApproveAgent",
 * "ApproveBuilder", "UpdateBuilder", "DelBuilder". It is not derivable from the
 * URL and a wrong one produces a signature that recovers to a different
 * address, so it is a required argument rather than something guessed here.
 */
export function buildMainWalletRequest(
  params: AsterParams,
  auth: AsterMainAuth,
  network: AsterNetwork,
  primaryType: string
): MainWalletRequest {
  const config = asterNetwork(network);
  const entries = serialise({
    ...params,
    asterChain: config.asterChain,
    user: auth.user,
    nonce: auth.nonce,
  });

  // The typed message uses the ORIGINAL values, not the serialised strings -
  // a bool has to hash as a bool. Rebuild from the same key order so the
  // message and the wire parameters cannot describe different requests.
  const source: AsterParams = {
    ...params,
    asterChain: config.asterChain,
    user: auth.user,
    nonce: auth.nonce,
  };

  const fields: { name: string; type: string }[] = [];
  const message: Record<string, AsterParamValue> = {};

  entries.forEach(([key]) => {
    const value = source[key];
    if (value === undefined || value === null) return;
    const name = capitalise(key);
    fields.push({ name, type: inferFieldType(value) });
    message[name] = value;
  });

  return {
    entries,
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
        [primaryType]: fields,
      },
      primaryType,
      message,
    },
  };
}

/**
 * Where an approved Aster agent lives between visits.
 *
 * The agent's private key is the one thing here that matters. It signs every
 * order, so it is stored the same way this app already stores a Bybit secret:
 * encrypted in the browser under a passphrase only the user knows, via
 * `lib/exchange/crypto.ts`. Nothing readable reaches our database or our logs,
 * and the server cannot sign on a user's behalf even if it wanted to.
 *
 * Everything else in the record is public by nature - two addresses and a
 * timestamp - and is stored in the clear so the terminal can tell whether an
 * approval exists, and whether it has lapsed, without asking for a passphrase
 * first. Prompting for an unlock only to discover the approval expired last
 * month would be a poor trade.
 */

import type { EncryptedSecret } from "@/lib/exchange/crypto";
import { STORAGE_KEYS, scopedKey } from "@/lib/storageKeys";
import type { AsterNetwork } from "@/lib/exchange/aster/endpoints";

export interface StoredAgent {
  /** The wallet that owns the funds. */
  user: string;
  /** The delegated wallet that signs orders. */
  address: string;
  /** Milliseconds since epoch, as approved. */
  expiresAt: number;
  network: AsterNetwork;
  /** The agent's private key, encrypted under the user's passphrase. */
  key: EncryptedSecret;
}

function storageKey(userId: string | null): string {
  return scopedKey(STORAGE_KEYS.asterAgent, userId);
}

/**
 * Whether an approval is still usable.
 *
 * Checked locally rather than left to the venue, because an expired agent
 * fails at Aster as an authorisation error - which is indistinguishable, from
 * the user's side, from the app being broken. Knowing beforehand lets the
 * terminal say "your approval expired, sign once more" instead.
 *
 * The margin exists because the check and the order are not simultaneous. An
 * approval with thirty seconds left passes here and is gone by the time the
 * order lands, so anything inside the margin is treated as already expired.
 */
export const EXPIRY_MARGIN_MS = 5 * 60 * 1000;

export function isUsable(agent: StoredAgent | null, now: number = Date.now()): boolean {
  if (!agent) return false;
  return agent.expiresAt - EXPIRY_MARGIN_MS > now;
}

/** Whether a stored agent belongs to the wallet currently connected.
 *
 *  Addresses are compared case-insensitively: a browser wallet may report a
 *  checksummed address where the stored one is lower-cased, and treating those
 *  as different accounts would silently discard a valid approval and ask the
 *  user to sign again for no reason. */
export function belongsTo(agent: StoredAgent | null, wallet: string | null): boolean {
  if (!agent || !wallet) return false;
  return agent.user.toLowerCase() === wallet.toLowerCase();
}

export function saveAgent(agent: StoredAgent, userId: string | null): void {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(agent));
  } catch {
    // Storage blocked. The approval still works for this session; it just will
    // not survive a reload, and the user is asked to sign again next time.
  }
}

/**
 * Reads the stored agent, or null.
 *
 * A record that does not parse, or that is missing any field the signing path
 * depends on, is treated as absent rather than repaired. A half-written record
 * would otherwise surface as a signature failure at the venue, which is a far
 * harder thing to diagnose than being asked to approve again.
 */
export function loadAgent(userId: string | null): StoredAgent | null {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredAgent>;
    if (
      typeof parsed.user !== "string" ||
      typeof parsed.address !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      (parsed.network !== "mainnet" && parsed.network !== "testnet") ||
      !parsed.key ||
      typeof parsed.key.ciphertext !== "string"
    ) {
      return null;
    }

    return parsed as StoredAgent;
  } catch {
    return null;
  }
}

export function clearAgent(userId: string | null): void {
  try {
    window.localStorage.removeItem(storageKey(userId));
  } catch {
    // Nothing to do.
  }
}

/**
 * Which upstream a relayed request is allowed to reach.
 *
 * The relay's whole security posture rests on one rule: the caller says WHAT it
 * wants, never WHERE it goes. A browser supplies a venue name and a path, and
 * this module turns those into an origin from a fixed table. Nothing a caller
 * sends is ever concatenated into a hostname, so the relay cannot be aimed at
 * an attacker's server and used to launder requests through our IP.
 *
 * Split out of the route handler because it is the part worth testing directly,
 * and because a route handler cannot be imported into a unit test without
 * dragging Next's request machinery along with it.
 */

import { ALLOWED_PATH_PREFIXES, BYBIT_HOSTS } from "@/lib/exchange/bybit";
import { ASTER_NETWORKS } from "@/lib/exchange/aster/endpoints";

export type Venue = "bybit" | "aster";

/**
 * Aster exposes one versioned prefix and this terminal uses only V3.
 *
 * Deliberately not `/fapi/` - that would also admit `/fapi/v1/`, the legacy
 * API-key endpoints Aster stopped issuing keys for in March 2026. A request
 * there could not succeed with a V3 agent signature, so allowing it would only
 * widen what the relay can be pointed at in exchange for nothing.
 */
export const ASTER_PATH_PREFIXES = ["/fapi/v3/"] as const;

interface VenueRoute {
  /** Full origin, scheme included. */
  origin: Readonly<Record<"mainnet" | "testnet", string>>;
  prefixes: readonly string[];
}

const ROUTES: Readonly<Record<Venue, VenueRoute>> = {
  bybit: {
    // Bybit's table holds bare hostnames; Aster's holds full origins. Both are
    // normalised to a full origin here so the caller never has to know which.
    origin: {
      mainnet: `https://${BYBIT_HOSTS.mainnet}`,
      testnet: `https://${BYBIT_HOSTS.testnet}`,
    },
    prefixes: ALLOWED_PATH_PREFIXES,
  },
  aster: {
    origin: {
      mainnet: ASTER_NETWORKS.mainnet.host,
      testnet: ASTER_NETWORKS.testnet.host,
    },
    prefixes: ASTER_PATH_PREFIXES,
  },
};

/** Narrows an untrusted value to a venue we route for. Unknown names are not
 *  defaulted to anything - an unrecognised venue is a rejected request. */
export function parseVenue(value: unknown): Venue | null {
  return value === "bybit" || value === "aster" ? value : null;
}

/**
 * Whether a path may be relayed to a venue.
 *
 * Traversal is rejected outright rather than normalised away. Every legitimate
 * path here is a literal from a short list, so a `..` in one is never a caller
 * being clever about a relative path - it is someone trying to escape the
 * prefix check, and the correct answer is no rather than a cleaned-up yes.
 */
export function isAllowedPath(venue: Venue, path: string): boolean {
  if (typeof path !== "string" || path.includes("..")) return false;
  return ROUTES[venue].prefixes.some((prefix) => path.startsWith(prefix));
}

/**
 * The absolute URL a relayed request should be sent to, or null if it may not
 * be sent at all.
 *
 * Returning null rather than throwing keeps the decision and the HTTP status in
 * the route handler, where the response shape lives.
 */
export function resolveUpstream(
  venue: Venue,
  testnet: boolean,
  path: string,
  query: string
): string | null {
  if (!isAllowedPath(venue, path)) return null;
  const origin = ROUTES[venue].origin[testnet ? "testnet" : "mainnet"];
  return `${origin}${path}${query ? `?${query}` : ""}`;
}

/**
 * Whether this venue takes our broker attribution header.
 *
 * Only Bybit does. On Aster the equivalent is an order parameter inside the
 * signed payload, which the relay cannot add without invalidating a signature
 * it has no key to recompute - so there is nothing for it to attach here, and
 * pretending otherwise would send an empty header that Aster ignores while
 * looking like attribution is working.
 */
export function takesBrokerHeader(venue: Venue): boolean {
  return venue === "bybit";
}

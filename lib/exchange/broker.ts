/**
 * The headers the relay sends upstream to Bybit.
 *
 * Split out of the route handler so both halves can be tested directly: what a
 * caller is allowed to forward, and what we add ourselves.
 */

/**
 * Only these may be forwarded from the browser. Everything else the caller
 * sends is dropped.
 *
 * Note what is absent: `x-referer`. That header identifies us to Bybit, not the
 * user, so a caller must not be able to set it - otherwise anyone could route
 * their volume to a different broker, or claim ours.
 */
export const FORWARDABLE_HEADERS = new Set([
  "x-bapi-api-key",
  "x-bapi-timestamp",
  "x-bapi-recv-window",
  "x-bapi-sign",
  "x-bapi-sign-type",
  "content-type",
]);

/**
 * Bybit's broker attribution header.
 *
 * Bybit accepts broker ID either as this header or as a `referer` field inside
 * the request body. It has to be the header here, and that is not a preference:
 * the V5 signature is HMAC over `timestamp + apiKey + recvWindow + payload`, so
 * editing the body would invalidate a signature this relay cannot recompute -
 * it never sees the user's API secret, by design. Headers are outside the
 * signed string, so adding one is safe.
 */
export const BROKER_HEADER = "X-Referer";

/**
 * Builds the upstream headers: the caller's allowlisted ones, then ours.
 *
 * Order matters. The broker ID is applied last so a caller cannot override it
 * by sending their own - belt as well as the braces of FORWARDABLE_HEADERS.
 */
export function buildUpstreamHeaders(
  provided: Record<string, unknown>,
  brokerId?: string | null
): Headers {
  const headers = new Headers();

  Object.entries(provided).forEach(([name, value]) => {
    if (typeof value === "string" && FORWARDABLE_HEADERS.has(name.toLowerCase())) {
      headers.set(name, value);
    }
  });

  // Absent is the normal case until Bybit approves a broker account. Absent
  // must mean "send nothing" rather than an empty header: an empty X-Referer
  // is not an error Bybit reports, so the volume would simply be attributed to
  // nobody while looking exactly like it was working.
  const id = brokerId?.trim();
  if (id) headers.set(BROKER_HEADER, id);

  return headers;
}

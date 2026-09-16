/**
 * Relay for already-signed exchange requests.
 *
 * This exists only because browsers cannot call an exchange's authenticated
 * endpoints directly (no CORS). It forwards a request the browser already
 * signed and returns the response - it never sees an API secret, and it
 * cannot alter the request, because the signature covers the timestamp, key,
 * recv-window and the exact body bytes.
 *
 * What it CAN do is drop, delay or replay a request, or lie about a response.
 * That is the accepted cost of the design, and much smaller than the
 * alternative of holding every user's key server-side.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseVenue, resolveUpstream, takesBrokerHeader } from "@/lib/exchange/routing";
import { buildUpstreamHeaders } from "@/lib/exchange/broker";

export const runtime = "nodejs";
/** Never cached, never prerendered: every request is user-specific. */
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8 * 1024;
const UPSTREAM_TIMEOUT_MS = 10_000;
/** Only these headers reach the exchange. Anything else the client sets is
 * dropped rather than forwarded. */
/**
 * Our Bybit API Broker ID, once the account has one.
 *
 * Server-side and deliberately NOT NEXT_PUBLIC: this identifies us to Bybit,
 * not the user, and nothing in the browser should be able to read or set it.
 * Absent until Bybit's Broker Management approves the account, and absent means
 * the relay behaves exactly as it did before this existed.
 */
const BROKER_ID = process.env.BYBIT_BROKER_ID?.trim() || null;

const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX = 60;
/**
 * A per-IP allowance spent BEFORE resolveUser runs.
 *
 * resolveUser is a network round trip to Supabase on every request, and the
 * 401 path was not metered at all: the most expensive thing this route does
 * was the one thing anyone could do without an account, for free, forever.
 *
 * Deliberately the same size as the per-user limit rather than smaller. A
 * signed-in trader passes through this meter too, and anything tighter would
 * throttle real trading to protect against a flood - so this can never be the
 * binding constraint for a legitimate caller, while still capping an
 * anonymous hammer at six requests a second per address.
 */
const PRE_AUTH_RATE_LIMIT_MAX = RATE_LIMIT_MAX;
/** Sweep the bucket map once it gets this large. Without it the map only ever
 * grew: a key was added per caller and never removed, so an instance that
 * stayed warm accumulated one entry for every user who had ever called it. */
const MAX_TRACKED_KEYS = 5_000;
/**
 * Per-instance only: serverless spreads requests across instances, so this is
 * a speed bump against a runaway client rather than a real quota. A real
 * limiter needs shared storage (Redis/Upstash) and is deliberately out of
 * scope for v1.
 */
const hits = new Map<string, number[]>();

function sweepExpired(now: number) {
  for (const [key, times] of hits) {
    const newest = times[times.length - 1];
    if (newest === undefined || now - newest >= RATE_LIMIT_WINDOW_MS) hits.delete(key);
  }
}

function rateLimited(key: string, max = RATE_LIMIT_MAX): boolean {
  const now = Date.now();
  if (hits.size > MAX_TRACKED_KEYS) sweepExpired(now);
  const recent = (hits.get(key) ?? []).filter((at) => now - at < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > max;
}

/** Vercel sets x-forwarded-for on the way in, so the first entry is the real
 * client. Prefixed, so an address can never collide with a Supabase user id
 * and share its bucket. */
function callerKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `anon:${forwarded || request.headers.get("x-real-ip") || "unknown"}`;
}

/** Resolves the caller's Supabase user, or null. Live trading requires an
 * account (that is where the encrypted credentials live), so an unauthenticated
 * caller has no legitimate reason to reach the relay. */
async function resolveUser(request: Request): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const header = request.headers.get("authorization");
  const token = header?.toLowerCase().startsWith("bearer ") ? header.slice(7) : null;
  if (!token) return null;

  try {
    const { data, error } = await createClient(url, key).auth.getUser(token);
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

interface RelayBody {
  /** Which venue to reach. Absent means Bybit, so callers written before a
   *  second venue existed keep working unchanged. */
  venue?: unknown;
  testnet?: unknown;
  method?: unknown;
  path?: unknown;
  query?: unknown;
  body?: unknown;
  headers?: unknown;
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  // Metered before the Supabase lookup, not after: resolveUser is the round
  // trip worth protecting.
  if (rateLimited(callerKey(request), PRE_AUTH_RATE_LIMIT_MAX)) {
    return bad("Too many exchange requests. Slow down.", 429);
  }

  const userId = await resolveUser(request);
  if (!userId) {
    return bad("Live trading requires a signed-in account.", 401);
  }
  if (rateLimited(userId)) {
    return bad("Too many exchange requests. Slow down.", 429);
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return bad("Request too large.", 413);
  }

  let payload: RelayBody;
  try {
    payload = JSON.parse(raw) as RelayBody;
  } catch {
    return bad("Malformed relay request.");
  }

  const method = payload.method === "POST" ? "POST" : payload.method === "GET" ? "GET" : null;
  if (!method) return bad("Unsupported method.");

  // Absent means Bybit; an unrecognised name is refused rather than defaulted,
  // so a typo can never silently send a signed request to the wrong venue.
  const venue = payload.venue === undefined ? "bybit" : parseVenue(payload.venue);
  if (!venue) return bad("Unknown venue.");

  const path = typeof payload.path === "string" ? payload.path : "";
  const query = typeof payload.query === "string" ? payload.query : "";

  // The caller says what it wants; the table says where it goes. Nothing the
  // caller sends is concatenated into a hostname, so the relay cannot be aimed
  // at an arbitrary server and used to launder requests through our IP.
  const target = resolveUpstream(venue, payload.testnet === true, path, query);
  if (!target) return bad("That endpoint is not allowed.", 403);

  // Aster carries attribution inside the signed order parameters, which the
  // relay cannot touch without invalidating a signature it has no key to
  // recompute - so there is nothing to attach, and attaching an empty header
  // would look like attribution while crediting nobody.
  const headers = buildUpstreamHeaders(
    (payload.headers ?? {}) as Record<string, unknown>,
    takesBrokerHeader(venue) ? BROKER_ID : null
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(target, {
      method,
      headers,
      body: method === "POST" ? String(payload.body ?? "") : undefined,
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return bad(aborted ? "The exchange did not respond in time." : "Could not reach the exchange.", 502);
  } finally {
    clearTimeout(timeout);
  }
}

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
import { BYBIT_HOSTS, ALLOWED_PATH_PREFIXES } from "@/lib/exchange/bybit";

export const runtime = "nodejs";
/** Never cached, never prerendered: every request is user-specific. */
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8 * 1024;
const UPSTREAM_TIMEOUT_MS = 10_000;
/** Only these headers reach the exchange. Anything else the client sets is
 * dropped rather than forwarded. */
const FORWARDABLE_HEADERS = new Set([
  "x-bapi-api-key",
  "x-bapi-timestamp",
  "x-bapi-recv-window",
  "x-bapi-sign",
  "x-bapi-sign-type",
  "content-type",
]);

const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX = 60;
/**
 * Per-instance only: serverless spreads requests across instances, so this is
 * a speed bump against a runaway client rather than a real quota. A real
 * limiter needs shared storage (Redis/Upstash) and is deliberately out of
 * scope for v1.
 */
const hits = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((at) => now - at < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  hits.set(userId, recent);
  return recent.length > RATE_LIMIT_MAX;
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

  const path = typeof payload.path === "string" ? payload.path : "";
  // Reject traversal outright rather than trying to normalise it: every
  // legitimate path is a literal from a short allowlist.
  if (!ALLOWED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix)) || path.includes("..")) {
    return bad("That endpoint is not allowed.", 403);
  }

  // The host is chosen here, from a boolean - never taken from the caller, so
  // the relay can't be pointed at an arbitrary server.
  const host = payload.testnet === true ? BYBIT_HOSTS.testnet : BYBIT_HOSTS.mainnet;
  const query = typeof payload.query === "string" ? payload.query : "";
  const target = `https://${host}${path}${query ? `?${query}` : ""}`;

  const headers = new Headers();
  const provided = (payload.headers ?? {}) as Record<string, unknown>;
  Object.entries(provided).forEach(([name, value]) => {
    if (typeof value === "string" && FORWARDABLE_HEADERS.has(name.toLowerCase())) {
      headers.set(name, value);
    }
  });

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

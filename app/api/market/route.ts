import { NextResponse } from "next/server";

/**
 * Same-origin fallback for Bybit's PUBLIC market endpoints.
 *
 * The browser calls Bybit directly wherever it can; this exists only for the
 * case where that is refused. A CORS refusal is indistinguishable from a
 * network error in JS, so without a fallback a policy change at Bybit would
 * take the chart out everywhere with no way to tell why.
 *
 * Deliberately NOT the relay in app/api/exchange. That one requires a Supabase
 * session because it forwards signed, account-scoped requests. This carries no
 * credentials, reaches only public read-only endpoints, and has to serve the
 * landing page, where there is no session at all.
 */
const BYBIT_BASE = "https://api.bybit.com";

/** Read-only public endpoints, and nothing else. No account or order paths. */
const ALLOWED_PATHS = [
  "/v5/market/kline",
  "/v5/market/tickers",
  "/v5/market/orderbook",
  "/v5/market/instruments-info",
] as const;

const TIMEOUT_MS = 10_000;
/** Only the parameters these endpoints actually take, so this cannot be used to
 * smuggle anything else through to Bybit. */
const ALLOWED_PARAMS = new Set(["category", "symbol", "interval", "limit", "start", "end"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = url.searchParams.get("path");

  if (!path || !ALLOWED_PATHS.includes(path as (typeof ALLOWED_PATHS)[number])) {
    return NextResponse.json({ error: "Unsupported path" }, { status: 400 });
  }

  const forwarded = new URLSearchParams();
  for (const [key, value] of url.searchParams) {
    if (ALLOWED_PARAMS.has(key)) forwarded.set(key, value);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(`${BYBIT_BASE}${path}?${forwarded}`, {
      signal: controller.signal,
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "content-type": "application/json",
        // Public data that changes by the second; a few seconds of shared cache
        // keeps five markets off the origin on every page load.
        "cache-control": "public, max-age=0, s-maxage=5, stale-while-revalidate=30",
      },
    });
  } catch {
    return NextResponse.json({ error: "Upstream unavailable" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}

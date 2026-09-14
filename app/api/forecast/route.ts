import { NextResponse } from "next/server";
import {
  UNAVAILABLE_FORECAST,
  type ForecastRequest,
  type ForecastResponse,
} from "@/lib/mnq/forecast";

/**
 * Proxy to the Kronos forecasting sidecar.
 *
 * Kronos is a PyTorch model; it cannot run in this process and there is no
 * pretending otherwise. It lives in services/kronos as a separate FastAPI
 * deployment, and this route forwards to it.
 *
 * Absence is a normal state, not an error. With no KRONOS_SERVICE_URL the
 * route returns `available: false` and the dashboard renders a panel
 * explaining how to turn it on, rather than a broken widget or a 500.
 */

const TIMEOUT_MS = 20_000;
/** Guard against a client posting an unbounded context window. */
const MAX_CANDLES = 2048;

export async function POST(request: Request) {
  const serviceUrl = process.env.KRONOS_SERVICE_URL;
  if (!serviceUrl) {
    return NextResponse.json(UNAVAILABLE_FORECAST);
  }

  let body: ForecastRequest;
  try {
    body = (await request.json()) as ForecastRequest;
  } catch {
    return NextResponse.json({ error: "Malformed request body" }, { status: 400 });
  }

  if (!Array.isArray(body.candles) || body.candles.length === 0) {
    return NextResponse.json({ error: "candles required" }, { status: 400 });
  }

  const payload: ForecastRequest = {
    candles: body.candles.slice(-MAX_CANDLES),
    horizon: Math.max(1, Math.min(64, Number(body.horizon) || 24)),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(`${serviceUrl.replace(/\/$/, "")}/forecast`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Optional shared secret so a public sidecar is not open to the world.
        ...(process.env.KRONOS_SERVICE_TOKEN ? { authorization: `Bearer ${process.env.KRONOS_SERVICE_TOKEN}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!upstream.ok) {
      return NextResponse.json({
        ...UNAVAILABLE_FORECAST,
        note: `Kronos sidecar responded ${upstream.status}.`,
      } satisfies ForecastResponse);
    }

    return NextResponse.json((await upstream.json()) as ForecastResponse);
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError" ? "timed out" : "unreachable";
    return NextResponse.json({
      ...UNAVAILABLE_FORECAST,
      note: `Kronos sidecar ${reason}. Forecasts are off; setups are unaffected.`,
    } satisfies ForecastResponse);
  } finally {
    clearTimeout(timeout);
  }
}

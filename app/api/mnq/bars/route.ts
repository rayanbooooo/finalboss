import { NextResponse } from "next/server";
import { createSimulatedMnqSource, resolveMnqSource, type MnqBars } from "@/lib/mnq/feed";

/**
 * MNQ bars for the indices terminal.
 *
 * Server-side because the Databento key must not reach the browser. When no
 * key is configured, or Databento fails, this degrades to the simulator rather
 * than erroring: a dashboard that renders synthetic bars clearly labelled
 * SIMULATED is more useful than one showing a stack trace, and the `isLive`
 * flag in the payload is what the UI badges off.
 */

const MAX_LIMIT = 1500;
const ALLOWED_INTERVALS_MS = new Set([60_000, 300_000, 900_000, 3_600_000]);

export async function GET(request: Request) {
  const url = new URL(request.url);

  const intervalMs = Number(url.searchParams.get("intervalMs") ?? 60_000);
  if (!ALLOWED_INTERVALS_MS.has(intervalMs)) {
    return NextResponse.json({ error: "Unsupported interval" }, { status: 400 });
  }

  const limit = Math.min(MAX_LIMIT, Math.max(50, Number(url.searchParams.get("limit") ?? 600)));

  let payload: MnqBars;
  let degraded: string | null = null;

  try {
    payload = await resolveMnqSource().fetchBars({ intervalMs, limit });
  } catch (error) {
    degraded = error instanceof Error ? error.message : "Upstream unavailable";
    payload = await createSimulatedMnqSource().fetchBars({ intervalMs, limit });
  }

  return NextResponse.json(
    { ...payload, degraded },
    {
      headers: {
        // Bars only change once per interval; a few seconds of shared cache
        // keeps a page full of panels off Databento's metered API.
        "cache-control": "public, max-age=0, s-maxage=10, stale-while-revalidate=30",
      },
    },
  );
}

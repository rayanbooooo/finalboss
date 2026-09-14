import { NextResponse } from "next/server";
import { createSimulatedMnqSource, resolveMnqSource } from "@/lib/mnq/feed";
import { DEFAULT_SCAN_OPTIONS, scanSetups, summarise } from "@/lib/mnq/setups";

/**
 * Setups as JSON, for consumers outside the browser.
 *
 * Exists so the research pipeline in research/nautilus can execute exactly the
 * setups the dashboard shows. Porting the detection logic to Python would give
 * two implementations that agree until the first change to either, and a
 * backtest of code that is not the code you trade is worse than no backtest.
 */

const MAX_LIMIT = 5000;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const intervalMs = Number(url.searchParams.get("intervalMs") ?? 60_000);
  const limit = Math.min(MAX_LIMIT, Math.max(100, Number(url.searchParams.get("limit") ?? 1200)));
  const minScore = Number(url.searchParams.get("minScore") ?? DEFAULT_SCAN_OPTIONS.minScore);

  let bars;
  try {
    bars = await resolveMnqSource().fetchBars({ intervalMs, limit });
  } catch {
    bars = await createSimulatedMnqSource().fetchBars({ intervalMs, limit });
  }

  const scan = scanSetups(bars.candles, { minScore });

  return NextResponse.json({
    symbol: bars.symbol,
    source: bars.source,
    isLive: bars.isLive,
    intervalMs,
    barCount: bars.candles.length,
    firstBarTime: bars.candles[0]?.time ?? null,
    lastBarTime: bars.candles.at(-1)?.time ?? null,
    stats: summarise(scan.setups),
    // Realised R values, ready to feed straight into prop_sim.py.
    realisedR: scan.setups.map((s) => s.realisedR).filter((r): r is number => r !== null),
    setups: scan.setups.map((s) => ({
      id: s.id,
      time: s.time,
      direction: s.direction,
      pattern: s.pattern,
      entry: s.entry,
      stop: s.stop,
      target: s.target,
      stopPoints: s.stopPoints,
      rr: s.rr,
      score: s.score,
      session: s.session,
      status: s.status,
      realisedR: s.realisedR,
    })),
  });
}

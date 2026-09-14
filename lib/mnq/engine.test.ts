import { describe, expect, it } from "vitest";
import { MNQ, contractsForRisk, pointsToUsd, roundToTick, usdToPoints } from "@/lib/mnq/contract";
import { etParts, isMarketOpen, isRth, isKillzone, silverBulletAt, minutesUntilFlatten } from "@/lib/mnq/sessions";
import { analyzeStructure, findSwings, isOteZone, rangePosition } from "@/lib/mnq/structure";
import { findFairValueGaps, findLiquidityPools, findSweeps } from "@/lib/mnq/zones";
import {
  applyTrade,
  assessAccount,
  drawdownFloor,
  emptyAccount,
  gateSetup,
  RULE_PRESETS,
  riskBudgetUsd,
  type PropRules,
} from "@/lib/mnq/propRules";
import { generateMnqCandles } from "@/lib/mnq/feed";
import { DEFAULT_SCAN_OPTIONS, scanSetups, summarise } from "@/lib/mnq/setups";
import type { Candle } from "@/types/market";

/** Build a candle tersely; volume is irrelevant to every assertion here. */
const bar = (time: number, open: number, high: number, low: number, close: number): Candle => ({
  time, open, high, low, close, volume: 1000,
});

/** A UTC instant for a given ET wall-clock time, resolved by search so the
 * tests stay correct across DST without hardcoding offsets. */
function etInstant(dateKey: string, hour: number, minute: number): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  // Start from noon UTC on that date and walk to the matching ET wall clock.
  let ts = Date.UTC(y, m - 1, d, 12, 0, 0);
  for (let i = 0; i < 48; i++) {
    const parts = etParts(ts);
    if (parts.dateKey === dateKey && parts.hour === hour && parts.minute === minute) return ts;
    ts += 60_000 * 30;
  }
  // Fall back to a fine sweep for half-hour-offset edge cases.
  ts = Date.UTC(y, m - 1, d, 0, 0, 0);
  for (let i = 0; i < 60 * 48; i++) {
    const parts = etParts(ts);
    if (parts.dateKey === dateKey && parts.hour === hour && parts.minute === minute) return ts;
    ts += 60_000;
  }
  throw new Error(`Could not resolve ${dateKey} ${hour}:${minute} ET`);
}

describe("contract maths", () => {
  it("values a point at $2 and a tick at $0.50", () => {
    expect(MNQ.pointValue).toBe(2);
    expect(pointsToUsd(1)).toBe(2);
    expect(pointsToUsd(MNQ.tickSize)).toBe(MNQ.tickValue);
  });

  it("round-trips points and dollars across contract counts", () => {
    expect(usdToPoints(pointsToUsd(17.5, 3), 3)).toBeCloseTo(17.5, 10);
  });

  it("snaps prices to the 0.25 tick grid", () => {
    expect(roundToTick(24_801.13)).toBe(24_801.25);
    expect(roundToTick(24_801.12)).toBe(24_801.0);
  });

  it("floors contract count so risk is never exceeded", () => {
    // $100 budget, 20pt stop = $40/contract. 2.5 contracts -> 2, not 3.
    expect(contractsForRisk(100, 20)).toBe(2);
    expect(pointsToUsd(20, contractsForRisk(100, 20))).toBeLessThanOrEqual(100);
  });

  it("returns zero contracts when one lot already breaks the budget", () => {
    expect(contractsForRisk(30, 40)).toBe(0);
  });
});

describe("sessions", () => {
  it("keeps killzones on the ET clock across the DST boundary", () => {
    // Same ET wall-clock time either side of the US spring-forward.
    const winter = etInstant("2026-01-14", 9, 45);
    const summer = etInstant("2026-07-15", 9, 45);
    expect(isKillzone(winter)).toBe(true);
    expect(isKillzone(summer)).toBe(true);
    expect(isRth(winter)).toBe(true);
    expect(isRth(summer)).toBe(true);
    // And their UTC hours genuinely differ, proving the conversion happened.
    expect(new Date(winter).getUTCHours()).not.toBe(new Date(summer).getUTCHours());
  });

  it("closes the market on Saturday and during the daily halt", () => {
    expect(isMarketOpen(etInstant("2026-09-12", 12, 0))).toBe(false); // Saturday
    expect(isMarketOpen(etInstant("2026-09-16", 17, 30))).toBe(false); // Wed halt
    expect(isMarketOpen(etInstant("2026-09-16", 18, 30))).toBe(true); // reopened
  });

  it("identifies silver bullet windows", () => {
    expect(silverBulletAt(etInstant("2026-09-16", 10, 30))?.label).toBe("NY AM SB");
    expect(silverBulletAt(etInstant("2026-09-16", 11, 30))).toBeNull();
  });

  it("counts down to the flatten deadline", () => {
    const now = etInstant("2026-09-16", 16, 45);
    expect(minutesUntilFlatten(now, 16 * 60 + 59)).toBe(14);
  });
});

describe("structure", () => {
  const candles: Candle[] = [
    bar(1, 100, 102, 99, 101), bar(2, 101, 103, 100, 102), bar(3, 102, 104, 101, 103),
    bar(4, 103, 110, 102, 109), // swing high at 110
    bar(5, 109, 108, 104, 105), bar(6, 105, 106, 103, 104), bar(7, 104, 105, 102, 103),
    bar(8, 103, 104, 95, 96), // swing low at 95
    bar(9, 96, 100, 96, 99), bar(10, 99, 102, 98, 101), bar(11, 101, 104, 100, 103),
    bar(12, 103, 112, 102, 111), // closes above 110 -> bullish break
    bar(13, 111, 113, 110, 112), bar(14, 112, 114, 111, 113), bar(15, 113, 115, 112, 114),
  ];

  it("finds fractal swings and only confirms them after the lookback", () => {
    const swings = findSwings(candles, 3);
    const high = swings.find((s) => s.kind === "high" && s.price === 110);
    expect(high).toBeDefined();
    expect(high!.confirmedIndex).toBe(high!.index + 3);
  });

  it("emits a structure break only on a close through the level", () => {
    const state = analyzeStructure(candles, 3);
    const bullish = state.events.filter((e) => e.direction === "bullish");
    expect(bullish.length).toBeGreaterThan(0);
    expect(state.trend).toBe("bullish");
  });

  it("places OTE on the correct side of equilibrium for each direction", () => {
    const range = { low: 100, high: 200, equilibrium: 150 };
    expect(rangePosition(125, range)).toBeCloseTo(0.25);
    // Longs want discount, shorts want premium.
    expect(isOteZone(130, range, "bullish")).toBe(true);
    expect(isOteZone(170, range, "bearish")).toBe(true);
    expect(isOteZone(170, range, "bullish")).toBe(false);
  });
});

describe("zones", () => {
  it("detects a bullish fair value gap left by a displacement bar", () => {
    // Bar 1 high 101 < bar 3 low 108, with a large-bodied bar 2 between them.
    const candles: Candle[] = [
      bar(1, 100, 100.5, 99.5, 100), bar(2, 100, 100.8, 99.6, 100.2), bar(3, 100, 100.6, 99.4, 100.1),
      bar(4, 100, 100.7, 99.5, 100.2), bar(5, 100, 100.9, 99.3, 100.4), bar(6, 100, 100.5, 99.8, 100),
      bar(7, 100, 100.6, 99.7, 100.1), bar(8, 100, 100.4, 99.6, 100), bar(9, 100, 100.8, 99.5, 100.2),
      bar(10, 100, 100.6, 99.4, 100.1), bar(11, 100, 100.7, 99.6, 100.3), bar(12, 100, 100.5, 99.5, 100),
      bar(13, 100, 100.9, 99.7, 100.2), bar(14, 100, 100.6, 99.4, 100.1), bar(15, 100, 101, 99.8, 100.5),
      bar(16, 100.5, 108, 100.4, 107.8), // displacement
      bar(17, 107.8, 110, 105, 109),
    ];
    const gaps = findFairValueGaps(candles, 1.0);
    const bullish = gaps.find((g) => g.direction === "bullish");
    expect(bullish).toBeDefined();
    expect(bullish!.low).toBeCloseTo(101, 5);
    expect(bullish!.high).toBeCloseTo(105, 5);
    // Completed on the third bar, never the middle one.
    expect(bullish!.index).toBe(16);
  });

  it("treats a wick through equal highs that closes back inside as a sweep", () => {
    // Two genuine swing highs at 110 (each with a lower bar either side), then
    // a bar that wicks through them and closes back underneath.
    const candles: Candle[] = [
      bar(1, 100, 102, 99, 101),
      bar(2, 101, 110, 100, 105), // swing high
      bar(3, 105, 106, 101, 102),
      bar(4, 102, 104, 100, 103),
      bar(5, 103, 110, 102, 106), // equal swing high
      bar(6, 106, 107, 103, 104),
      bar(7, 104, 115, 103, 107), // wicks to 115, closes below 110
    ];
    const swings = findSwings(candles, 1);
    const pools = findLiquidityPools(candles, swings, { tolerancePoints: 1, minTouches: 2 });
    const buySide = pools.filter((p) => p.side === "buy-side");
    expect(buySide.length).toBeGreaterThan(0);

    const sweeps = findSweeps(candles, pools);
    const raid = sweeps.find((s) => s.index === 6);
    expect(raid).toBeDefined();
    // A buy-side raid implies the move is down.
    expect(raid!.direction).toBe("bearish");
    expect(raid!.penetration).toBeGreaterThan(0);
  });
});

describe("prop rules", () => {
  const intraday = RULE_PRESETS.find((r) => r.id === "trailing-intraday-50k")!;

  it("trails the floor on unrealised profit that was then given back", () => {
    let account = emptyAccount(intraday);
    expect(drawdownFloor(account, intraday)).toBe(48_000);

    // Trade runs +$800 open, then closes at +$100.
    account = applyTrade(account, { pnlUsd: 100, peakOpenPnlUsd: 800, dateKey: "2026-09-14" });

    // The floor followed the PEAK, not the close. This is the rule that kills
    // accounts and the whole reason the engine models it.
    expect(account.peakEquity).toBe(50_800);
    expect(drawdownFloor(account, intraday)).toBe(48_800);

    const assessment = assessAccount(account, intraday);
    // Balance is 50,100 but only 1,300 of room remains — not the 2,100 a
    // naive "balance minus starting drawdown" calculation would report.
    expect(assessment.equity).toBe(50_100);
    expect(assessment.roomUsd).toBe(1_300);
  });

  it("does not trail end-of-day mode on intraday spikes", () => {
    const eod = RULE_PRESETS.find((r) => r.id === "trailing-eod-50k")!;
    let account = emptyAccount(eod);
    account = applyTrade(account, { pnlUsd: 100, peakOpenPnlUsd: 800, dateKey: "2026-09-14" });
    // EOD mode ignores the spike entirely until the day is rolled.
    expect(drawdownFloor(account, eod)).toBe(48_000);
  });

  it("locks the floor once the lock threshold is reached", () => {
    let account = emptyAccount(intraday);
    account = applyTrade(account, { pnlUsd: 5_000, peakOpenPnlUsd: 5_000, dateKey: "2026-09-14" });
    // lockAtProfit 2000, amount 2000 -> locks at 50,000, never higher.
    expect(drawdownFloor(account, intraday)).toBe(50_000);
  });

  it("shrinks risk budget as the account nears its floor", () => {
    const healthy = assessAccount(emptyAccount(intraday), intraday);
    let hurt = emptyAccount(intraday);
    hurt = applyTrade(hurt, { pnlUsd: -1_500, peakOpenPnlUsd: 0, dateKey: "2026-09-14" });
    const hurtAssessment = assessAccount(hurt, intraday);

    expect(riskBudgetUsd(hurtAssessment, intraday)).toBeLessThan(riskBudgetUsd(healthy, intraday));
    expect(hurtAssessment.warnings.some((w) => w.includes("drawdown"))).toBe(true);
  });

  it("blocks a setup whose one-lot stop exceeds the risk budget", () => {
    const account = emptyAccount(intraday);
    const gate = gateSetup(
      { stopPoints: 200, targetPoints: 400, timestampMs: etInstant("2026-09-16", 10, 0) },
      account,
      intraday,
    );
    expect(gate.allowed).toBe(false);
    expect(gate.contracts).toBe(0);
    expect(gate.reasons.join(" ")).toContain("budget");
  });

  it("blocks new setups past the flatten deadline", () => {
    const account = emptyAccount(intraday);
    const gate = gateSetup(
      { stopPoints: 10, targetPoints: 20, timestampMs: etInstant("2026-09-16", 17, 30) },
      account,
      intraday,
    );
    expect(gate.allowed).toBe(false);
    expect(gate.reasons.join(" ")).toContain("flatten");
  });

  it("allows a properly sized setup inside the session", () => {
    const account = emptyAccount(intraday);
    const gate = gateSetup(
      { stopPoints: 10, targetPoints: 25, timestampMs: etInstant("2026-09-16", 10, 0) },
      account,
      intraday,
    );
    expect(gate.allowed).toBe(true);
    expect(gate.contracts).toBeGreaterThanOrEqual(1);
    // Sized risk must not exceed the budget it was sized from.
    expect(pointsToUsd(10, gate.contracts)).toBeLessThanOrEqual(gate.riskUsd);
  });

  it("flags a consistency breach with the shortfall needed to clear it", () => {
    const rules: PropRules = { ...intraday, consistencyPct: 0.3 };
    let account = emptyAccount(rules);
    account = applyTrade(account, { pnlUsd: 900, peakOpenPnlUsd: 900, dateKey: "2026-09-14" });
    account = applyTrade(account, { pnlUsd: 100, peakOpenPnlUsd: 100, dateKey: "2026-09-15" });
    // Best day is 900 of 1000 = 90%, way over 30%.
    const assessment = assessAccount(account, rules);
    expect(assessment.warnings.some((w) => w.startsWith("Consistency"))).toBe(true);
  });
});

describe("scanner", () => {
  const candles = generateMnqCandles({ intervalMs: 60_000, limit: 1200, endMs: Date.UTC(2026, 8, 11, 20, 0) });

  it("generates only open-session bars, in ascending time", () => {
    expect(candles.length).toBe(1200);
    for (let i = 1; i < candles.length; i++) {
      expect(candles[i].time).toBeGreaterThan(candles[i - 1].time);
      expect(isMarketOpen(candles[i].time)).toBe(true);
    }
  });

  it("keeps every bar internally consistent", () => {
    for (const c of candles) {
      expect(c.high).toBeGreaterThanOrEqual(Math.max(c.open, c.close));
      expect(c.low).toBeLessThanOrEqual(Math.min(c.open, c.close));
    }
  });

  it("finds setups, all inside killzones, with sane risk geometry", () => {
    const result = scanSetups(candles);
    expect(result.setups.length).toBeGreaterThan(0);

    for (const setup of result.setups) {
      expect(isKillzone(setup.time)).toBe(true);
      expect(setup.stopPoints).toBeGreaterThan(0);
      expect(setup.rr).toBeGreaterThanOrEqual(1.5);
      // Targets are capped relative to the stop. Uncapped, findTarget would
      // select an untapped pool 380 points from an 8-point stop and call it a
      // 46R setup — a price that will not be reached inside the trade, and one
      // that distorts every expectancy figure downstream.
      expect(setup.rr).toBeLessThanOrEqual(DEFAULT_SCAN_OPTIONS.maxTargetR);
      expect(setup.score).toBeGreaterThanOrEqual(45);
      // Stop and target must straddle entry in the right directions.
      if (setup.direction === "bullish") {
        expect(setup.stop).toBeLessThan(setup.entry);
        expect(setup.target).toBeGreaterThan(setup.entry);
      } else {
        expect(setup.stop).toBeGreaterThan(setup.entry);
        expect(setup.target).toBeLessThan(setup.entry);
      }
    }
  });

  it("is deterministic for a given seed", () => {
    const a = scanSetups(generateMnqCandles({ intervalMs: 60_000, limit: 400, endMs: Date.UTC(2026, 8, 11, 20, 0) }));
    const b = scanSetups(generateMnqCandles({ intervalMs: 60_000, limit: 400, endMs: Date.UTC(2026, 8, 11, 20, 0) }));
    expect(a.setups.map((s) => s.id)).toEqual(b.setups.map((s) => s.id));
  });

  it("resolves outcomes and summarises them without inventing wins", () => {
    const { setups } = scanSetups(candles);
    const stats = summarise(setups);
    expect(stats.total).toBe(setups.length);
    expect(stats.wins + stats.losses).toBe(stats.resolved);
    expect(stats.winRate).toBeGreaterThanOrEqual(0);
    expect(stats.winRate).toBeLessThanOrEqual(1);
    // Losers are exactly -1R by construction; winners are their planned R.
    for (const s of setups) {
      if (s.status === "stopped") expect(s.realisedR).toBe(-1);
      if (s.status === "target") expect(s.realisedR).toBeCloseTo(s.rr, 10);
    }
  });
});

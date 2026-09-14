import type { Candle } from "@/types/market";
import { MNQ, roundToTick, pointsToUsd } from "@/lib/mnq/contract";
import { atrSeries } from "@/lib/mnq/indicators";
import {
  analyzeStructure,
  isFavourablePricing,
  isOteZone,
  structureAt,
  type Direction,
  type StructureState,
} from "@/lib/mnq/structure";
import {
  findFairValueGaps,
  findLiquidityPools,
  findOrderBlocks,
  findSweeps,
  unmitigatedAt,
  type FairValueGap,
  type LiquidityPool,
  type LiquiditySweep,
  type OrderBlock,
} from "@/lib/mnq/zones";
import { isKillzone, sessionAt, silverBulletAt, etParts, type SessionId } from "@/lib/mnq/sessions";

/**
 * The scanner. Turns bars into scored, tradeable setups.
 *
 * The design decision worth knowing: a setup is emitted with a `pending`
 * status at the bar where its conditions complete, with entry, stop and target
 * already fixed. It does not get to move them later. A scanner that adjusts
 * its own stop once it sees the next bar will report an edge it cannot trade,
 * and the whole point of this module is producing numbers the prop-rule gate
 * can be trusted to size against.
 */

export type SetupPattern =
  /** Liquidity raided, then structure rejects it — the reversal core. */
  | "sweep-reversal"
  /** Retrace into an unmitigated fair value gap with the trend. */
  | "fvg-continuation"
  /** Retest of the order block that originated the displacement leg. */
  | "ob-retest";

export type SetupStatus = "pending" | "triggered" | "target" | "stopped" | "invalidated";

export interface Confluence {
  label: string;
  /** Contribution to the score when met. */
  weight: number;
  met: boolean;
  /** Shown in the dashboard tooltip when the factor is missing. */
  detail?: string;
}

export interface Setup {
  id: string;
  index: number;
  time: number;
  direction: Direction;
  pattern: SetupPattern;
  entry: number;
  stop: number;
  target: number;
  /** Stop distance in index points. Always positive. */
  stopPoints: number;
  targetPoints: number;
  /** Reward-to-risk at the planned levels. */
  rr: number;
  /** 0–100 confluence score. */
  score: number;
  confluences: Confluence[];
  session: SessionId;
  /** Plain-language reason this fired, for the setup feed. */
  narrative: string;
  status: SetupStatus;
  /** Bar index where the status last changed, once resolved. */
  resolvedIndex: number | null;
  /** Realised R once resolved: +rr on target, -1 on stop. */
  realisedR: number | null;
}

export interface ScanOptions {
  /** Fractal width for swing detection. */
  swingLookback: number;
  /** How many bars a sweep stays relevant for. */
  sweepWindow: number;
  /** Minimum R:R for a setup to be emitted at all. */
  minRr: number;
  /** Minimum score for a setup to be emitted at all. */
  minScore: number;
  /** Ticks of padding beyond the structural stop level. */
  stopBufferTicks: number;
  /**
   * Absolute minimum stop width in index points.
   *
   * An ATR-relative floor alone is not enough: in a quiet session ATR collapses
   * and the scanner starts emitting 1.75pt stops, which is 7 ticks. Spread plus
   * one tick of slippage takes those out regardless of whether the read was
   * right, and they flatter the backtest by making R look huge.
   */
  minStopPoints: number;
  /** Only emit setups inside London / NY AM / NY PM. */
  killzonesOnly: boolean;
}

export const DEFAULT_SCAN_OPTIONS: ScanOptions = {
  swingLookback: 3,
  sweepWindow: 12,
  minRr: 1.5,
  minScore: 45,
  stopBufferTicks: 4,
  minStopPoints: 5,
  killzonesOnly: true,
};

export interface ScanResult {
  setups: Setup[];
  structure: StructureState;
  fvgs: FairValueGap[];
  orderBlocks: OrderBlock[];
  pools: LiquidityPool[];
  sweeps: LiquiditySweep[];
}

export function scanSetups(candles: Candle[], options: Partial<ScanOptions> = {}): ScanResult {
  const opts = { ...DEFAULT_SCAN_OPTIONS, ...options };
  const structure = analyzeStructure(candles, opts.swingLookback);
  const fvgs = findFairValueGaps(candles);
  const orderBlocks = findOrderBlocks(candles, structure);
  // Tolerance scales with volatility: "equal" highs on a 30-point-range day
  // are not equal on a 6-point-range day.
  const finiteAtr = atrSeries(candles).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const medianAtr = finiteAtr.length > 0 ? finiteAtr[Math.floor(finiteAtr.length / 2)] : 0;
  const pools = findLiquidityPools(candles, structure.swings, {
    tolerancePoints: Math.max(MNQ.tickSize * 4, medianAtr * 0.35),
  });
  const sweeps = findSweeps(candles, pools);
  const atr = atrSeries(candles);


  const setups: Setup[] = [];
  const sweepsByIndex = new Map<number, LiquiditySweep[]>();
  for (const sweep of sweeps) {
    const list = sweepsByIndex.get(sweep.index) ?? [];
    list.push(sweep);
    sweepsByIndex.set(sweep.index, list);
  }

  for (let i = opts.swingLookback; i < candles.length; i++) {
    const candle = candles[i];
    if (opts.killzonesOnly && !isKillzone(candle.time)) continue;

    const atrValue = atr[i];
    if (!Number.isFinite(atrValue) || atrValue <= 0) continue;

    // A sweep inside the recent window is what makes a reversal setup possible.
    const recentSweep = findRecentSweep(sweeps, i, opts.sweepWindow);

    // Unmitigated zones that price could still return into.
    const liveFvgs = unmitigatedAt(fvgs, i);
    const liveBlocks = unmitigatedAt(orderBlocks, i);

    const candidates: { pattern: SetupPattern; direction: Direction; zone: { low: number; high: number }; anchor: number }[] = [];

    if (recentSweep) {
      // After a sell-side raid the expectation is up, and vice versa.
      const direction = recentSweep.direction;
      const zone = nearestZone([...liveFvgs, ...liveBlocks], direction, candle.close, recentSweep.index);
      if (zone) {
        candidates.push({
          pattern: "sweep-reversal",
          direction,
          zone,
          // Stop goes beyond the wick that did the raiding.
          anchor: direction === "bullish" ? recentSweep.pool.price - recentSweep.penetration : recentSweep.pool.price + recentSweep.penetration,
        });
      }
    }

    const lastEvent = structureAt(structure, i);
    if (lastEvent) {
      const direction = lastEvent.direction;
      const fvg = nearestZone(liveFvgs.filter((z) => z.direction === direction), direction, candle.close, lastEvent.index);
      if (fvg) {
        candidates.push({ pattern: "fvg-continuation", direction, zone: fvg, anchor: direction === "bullish" ? fvg.low : fvg.high });
      }
      const block = nearestZone(liveBlocks.filter((z) => z.direction === direction), direction, candle.close, lastEvent.index);
      if (block) {
        candidates.push({ pattern: "ob-retest", direction, zone: block, anchor: direction === "bullish" ? block.low : block.high });
      }
    }

    for (const candidate of candidates) {
      const setup = buildSetup({ candle, index: i, candidate, structure, pools, atrValue, opts, recentSweep });
      if (!setup) continue;
      if (setup.rr < opts.minRr || setup.score < opts.minScore) continue;
      // One setup per bar per direction; the highest score wins.
      const clash = setups.find((s) => s.index === i && s.direction === setup.direction);
      if (clash) {
        if (setup.score > clash.score) setups[setups.indexOf(clash)] = setup;
        continue;
      }
      setups.push(setup);
    }
  }

  return { setups: resolveSetups(setups, candles), structure, fvgs, orderBlocks, pools, sweeps };
}

function findRecentSweep(sweeps: LiquiditySweep[], index: number, window: number): LiquiditySweep | null {
  let best: LiquiditySweep | null = null;
  for (const sweep of sweeps) {
    if (sweep.index > index) break;
    if (index - sweep.index <= window) best = sweep;
  }
  return best;
}

/** Closest zone to current price formed at or after `sinceIndex`, in `direction`. */
function nearestZone<T extends { low: number; high: number; index: number; direction: Direction }>(
  zones: T[],
  direction: Direction,
  price: number,
  sinceIndex: number,
): T | null {
  const eligible = zones.filter((z) => z.direction === direction && z.index >= sinceIndex - 2);
  if (eligible.length === 0) return null;

  return eligible.reduce((closest, zone) => {
    const mid = (zone.low + zone.high) / 2;
    const closestMid = (closest.low + closest.high) / 2;
    return Math.abs(mid - price) < Math.abs(closestMid - price) ? zone : closest;
  });
}

function buildSetup(args: {
  candle: Candle;
  index: number;
  candidate: { pattern: SetupPattern; direction: Direction; zone: { low: number; high: number }; anchor: number };
  structure: StructureState;
  pools: LiquidityPool[];
  atrValue: number;
  opts: ScanOptions;
  recentSweep: LiquiditySweep | null;
}): Setup | null {
  const { candle, index, candidate, structure, pools, atrValue, opts, recentSweep } = args;
  const { direction, zone, pattern } = candidate;

  // Consequent encroachment: the midpoint of the zone, which is where ICT
  // expects the reaction rather than the edge.
  const entry = roundToTick((zone.low + zone.high) / 2);
  const buffer = opts.stopBufferTicks * MNQ.tickSize;

  // The stop has to sit beyond BOTH the zone being entered and the level that
  // anchored the setup. Using the anchor alone produced longs whose stop was
  // above their entry whenever the zone sat below the swept wick — an instant,
  // guaranteed loss that the scanner happily reported as a valid 2R setup.
  const stop = roundToTick(
    direction === "bullish"
      ? Math.min(candidate.anchor, zone.low) - buffer
      : Math.max(candidate.anchor, zone.high) + buffer,
  );

  // Belt and braces: reject anything whose geometry is still inverted rather
  // than trusting the clamp above to have covered every path.
  const stopOnCorrectSide = direction === "bullish" ? stop < entry : stop > entry;
  if (!stopOnCorrectSide) return null;

  const stopPoints = Math.abs(entry - stop);
  // Two floors: relative to current volatility, and an absolute minimum.
  if (stopPoints < Math.max(opts.minStopPoints, atrValue * 0.25)) return null;

  const target = roundToTick(findTarget(entry, direction, pools, index, stopPoints));
  const targetOnCorrectSide = direction === "bullish" ? target > entry : target < entry;
  if (!targetOnCorrectSide) return null;

  const targetPoints = Math.abs(target - entry);
  if (targetPoints <= 0) return null;

  const rr = targetPoints / stopPoints;
  const confluences = scoreConfluences({ candle, index, direction, pattern, structure, entry, rr, recentSweep });
  const score = Math.round(
    (confluences.filter((c) => c.met).reduce((sum, c) => sum + c.weight, 0) /
      confluences.reduce((sum, c) => sum + c.weight, 0)) *
      100,
  );

  const session = sessionAt(candle.time);

  return {
    id: `${candle.time}-${direction}-${pattern}`,
    index,
    time: candle.time,
    direction,
    pattern,
    entry,
    stop,
    target,
    stopPoints,
    targetPoints,
    rr,
    score,
    confluences,
    session: session?.id ?? "closed",
    narrative: buildNarrative({ direction, pattern, recentSweep, session: session?.label ?? "Out of session", rr, stopPoints }),
    status: "pending",
    resolvedIndex: null,
    realisedR: null,
  };
}

/**
 * Target the opposing liquidity pool if there is one in range, otherwise a
 * fixed 2R. Targeting liquidity rather than a round multiple is the whole
 * premise: price is going somewhere to take stops, and that somewhere is a
 * level, not a number of points.
 */
function findTarget(entry: number, direction: Direction, pools: LiquidityPool[], index: number, stopPoints: number): number {
  const wanted = direction === "bullish" ? "buy-side" : "sell-side";
  const reachable = pools.filter(
    (p) => p.index <= index && p.sweptIndex === null && (direction === "bullish" ? p.price > entry : p.price < entry),
  );

  if (reachable.length > 0) {
    // Nearest untapped pool in the direction of travel.
    const nearest = reachable
      .filter((p) => p.side === wanted)
      .reduce<LiquidityPool | null>((best, pool) => {
        if (!best) return pool;
        return Math.abs(pool.price - entry) < Math.abs(best.price - entry) ? pool : best;
      }, null);
    if (nearest && Math.abs(nearest.price - entry) >= stopPoints) return nearest.price;
  }

  return direction === "bullish" ? entry + stopPoints * 2 : entry - stopPoints * 2;
}

function scoreConfluences(args: {
  candle: Candle;
  index: number;
  direction: Direction;
  pattern: SetupPattern;
  structure: StructureState;
  entry: number;
  rr: number;
  recentSweep: LiquiditySweep | null;
}): Confluence[] {
  const { candle, index, direction, structure, entry, rr, recentSweep } = args;
  const range = structure.dealingRange;
  const lastEvent = structureAt(structure, index);
  const silverBullet = silverBulletAt(candle.time);

  return [
    {
      label: "Trend alignment",
      weight: 20,
      met: structure.trend === direction,
      detail: `Structure is ${structure.trend}.`,
    },
    {
      label: "Liquidity swept",
      weight: 20,
      met: recentSweep !== null && recentSweep.direction === direction,
      detail: recentSweep ? `${recentSweep.pool.kind} raided ${index - recentSweep.index} bars ago.` : "No recent raid.",
    },
    {
      label: "Structure break",
      weight: 15,
      met: lastEvent !== null && lastEvent.direction === direction,
      detail: lastEvent ? `${lastEvent.kind.toUpperCase()} ${direction}.` : "No break yet.",
    },
    {
      label: "Killzone",
      weight: 15,
      met: isKillzone(candle.time),
      detail: "London / NY AM / NY PM only.",
    },
    {
      label: "Premium–discount",
      weight: 15,
      met: range !== null && isFavourablePricing(entry, range, direction),
      detail: range ? "Entry on the wrong side of equilibrium." : "No dealing range yet.",
    },
    {
      label: "OTE zone",
      weight: 10,
      met: range !== null && isOteZone(entry, range, direction),
      detail: "0.62–0.79 retracement.",
    },
    {
      label: "Silver bullet hour",
      weight: 5,
      met: silverBullet !== null,
      detail: silverBullet ? silverBullet.label : "Outside SB windows.",
    },
    {
      label: "R:R ≥ 2",
      weight: 10,
      met: rr >= 2,
      detail: `Planned ${rr.toFixed(2)}R.`,
    },
  ];
}

function buildNarrative(args: {
  direction: Direction;
  pattern: SetupPattern;
  recentSweep: LiquiditySweep | null;
  session: string;
  rr: number;
  stopPoints: number;
}): string {
  const { direction, pattern, recentSweep, session, rr, stopPoints } = args;
  const bias = direction === "bullish" ? "long" : "short";

  const lead =
    pattern === "sweep-reversal" && recentSweep
      ? `${recentSweep.pool.side === "buy-side" ? "Buy-side" : "Sell-side"} liquidity raided and rejected`
      : pattern === "fvg-continuation"
        ? "Retrace into an unmitigated fair value gap"
        : "Retest of the order block that started the leg";

  return `${lead} — ${bias} in ${session}. Stop ${stopPoints.toFixed(2)} pt ($${pointsToUsd(stopPoints).toFixed(2)}/contract), planned ${rr.toFixed(2)}R.`;
}

/**
 * Walk each setup forward to see what actually happened.
 *
 * Used by the backtest panel and the hit-rate stats. A bar that touches both
 * entry and stop is resolved pessimistically as a stop-out, because from
 * minute bars there is no way to know which came first and assuming the good
 * one is how backtests lie.
 */
export function resolveSetups(setups: Setup[], candles: Candle[], expiryBars = 60): Setup[] {
  return setups.map((setup) => {
    let triggered = false;

    for (let i = setup.index + 1; i < Math.min(candles.length, setup.index + 1 + expiryBars); i++) {
      const candle = candles[i];

      if (!triggered) {
        const touchedEntry =
          setup.direction === "bullish" ? candle.low <= setup.entry : candle.high >= setup.entry;
        if (touchedEntry) triggered = true;
        else continue;
      }

      const hitStop = setup.direction === "bullish" ? candle.low <= setup.stop : candle.high >= setup.stop;
      const hitTarget = setup.direction === "bullish" ? candle.high >= setup.target : candle.low <= setup.target;

      if (hitStop) return { ...setup, status: "stopped" as const, resolvedIndex: i, realisedR: -1 };
      if (hitTarget) return { ...setup, status: "target" as const, resolvedIndex: i, realisedR: setup.rr };
    }

    return triggered
      ? { ...setup, status: "triggered" as const, resolvedIndex: null, realisedR: null }
      : { ...setup, status: "invalidated" as const, resolvedIndex: null, realisedR: null };
  });
}

export interface SetupStats {
  total: number;
  resolved: number;
  wins: number;
  losses: number;
  winRate: number;
  /** Sum of realised R across resolved setups. */
  expectancyR: number;
  /** Average R per resolved setup. */
  averageR: number;
}

export function summarise(setups: Setup[]): SetupStats {
  const resolved = setups.filter((s) => s.realisedR !== null);
  const wins = resolved.filter((s) => (s.realisedR ?? 0) > 0).length;
  const totalR = resolved.reduce((sum, s) => sum + (s.realisedR ?? 0), 0);

  return {
    total: setups.length,
    resolved: resolved.length,
    wins,
    losses: resolved.length - wins,
    winRate: resolved.length > 0 ? wins / resolved.length : 0,
    expectancyR: totalR,
    averageR: resolved.length > 0 ? totalR / resolved.length : 0,
  };
}

/** ET date key for a bar, used to bucket setups by trading day. */
export function setupDateKey(setup: Setup): string {
  return etParts(setup.time).dateKey;
}

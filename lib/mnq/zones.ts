import type { Candle } from "@/types/market";
import { atrSeries, isDisplacement } from "@/lib/mnq/indicators";
import type { Direction, StructureState, SwingPoint } from "@/lib/mnq/structure";

/**
 * Price zones the setups are built from: fair value gaps, order blocks, and
 * the liquidity pools that get swept before a real move.
 *
 * Each zone carries the bar index it formed on and, where relevant, the bar it
 * was mitigated on. Nothing here looks forward: a zone is emitted on the bar
 * that completes it, and mitigation is only ever recorded at a later index.
 */

export interface PriceZone {
  /** Bar index on which the zone became complete and tradeable. */
  index: number;
  time: number;
  direction: Direction;
  /** Lower edge of the zone, in index points. */
  low: number;
  /** Upper edge of the zone. */
  high: number;
  /** Bar index where price first traded back into the zone, if it has. */
  mitigatedIndex: number | null;
}

export interface FairValueGap extends PriceZone {
  kind: "fvg";
  /** Gap width in points. Wider gaps came from stronger displacement. */
  size: number;
}

export interface OrderBlock extends PriceZone {
  kind: "order-block";
  /** True when the displacement out of this block also broke structure, which
   * is the difference between a real order block and any old opposing candle. */
  brokeStructure: boolean;
}

export type LiquidityKind = "equal-highs" | "equal-lows" | "session-high" | "session-low";

export interface LiquidityPool {
  index: number;
  time: number;
  price: number;
  kind: LiquidityKind;
  /** Buy-side liquidity sits above price (stops of shorts), sell-side below. */
  side: "buy-side" | "sell-side";
  /** How many touches formed this level. More touches, more resting stops. */
  touches: number;
  sweptIndex: number | null;
}

export interface LiquiditySweep {
  index: number;
  time: number;
  pool: LiquidityPool;
  /** Direction of the move expected AFTER the sweep — opposite to the raid. */
  direction: Direction;
  /** How far beyond the level the wick reached, in points. */
  penetration: number;
}

/**
 * Three-bar fair value gaps.
 *
 * A bullish FVG exists when bar i-1's high sits below bar i+1's low, leaving a
 * band of price that never traded on the way up. The middle bar must be a
 * genuine displacement or every quiet drift produces "gaps" that carry no
 * information.
 */
export function findFairValueGaps(candles: Candle[], minAtrMultiple = 1.2): FairValueGap[] {
  const gaps: FairValueGap[] = [];
  const atr = atrSeries(candles);

  for (let i = 1; i < candles.length - 1; i++) {
    const before = candles[i - 1];
    const middle = candles[i];
    const after = candles[i + 1];
    if (!isDisplacement(middle, atr[i], minAtrMultiple)) continue;

    if (before.high < after.low) {
      gaps.push({
        kind: "fvg",
        // Completed by the third bar, so that is when it can be acted on.
        index: i + 1,
        time: after.time,
        direction: "bullish",
        low: before.high,
        high: after.low,
        size: after.low - before.high,
        mitigatedIndex: null,
      });
    } else if (before.low > after.high) {
      gaps.push({
        kind: "fvg",
        index: i + 1,
        time: after.time,
        direction: "bearish",
        low: after.high,
        high: before.low,
        size: before.low - after.high,
        mitigatedIndex: null,
      });
    }
  }

  return markMitigation(gaps, candles);
}

/**
 * Order blocks: the last opposing candle before a displacement leg.
 *
 * Scans backwards from each displacement bar for the most recent candle that
 * closed against the move. `brokeStructure` records whether that leg also took
 * a structural level, which is what the scorer weights on.
 */
export function findOrderBlocks(candles: Candle[], structure: StructureState, minAtrMultiple = 1.2): OrderBlock[] {
  const blocks: OrderBlock[] = [];
  const atr = atrSeries(candles);
  const breakIndices = new Set(structure.events.map((e) => e.index));

  for (let i = 1; i < candles.length; i++) {
    const candle = candles[i];
    if (!isDisplacement(candle, atr[i], minAtrMultiple)) continue;

    const direction: Direction = candle.close > candle.open ? "bullish" : "bearish";

    // Look back a bounded distance; an "origin" twenty bars away is not the
    // origin of anything.
    let originIndex = -1;
    for (let back = i - 1; back >= Math.max(0, i - 10); back--) {
      const prior = candles[back];
      const priorIsDown = prior.close < prior.open;
      if (direction === "bullish" ? priorIsDown : !priorIsDown) {
        originIndex = back;
        break;
      }
    }
    if (originIndex === -1) continue;

    const origin = candles[originIndex];
    blocks.push({
      kind: "order-block",
      index: i,
      time: candle.time,
      direction,
      low: origin.low,
      high: origin.high,
      brokeStructure: breakIndices.has(i),
      mitigatedIndex: null,
    });
  }

  return markMitigation(blocks, candles);
}

/**
 * Equal highs and lows — the resting liquidity that gets raided.
 *
 * Built from SWING points, never from every bar's extreme. Clustering raw bar
 * highs on a 3000-bar MNQ series produced ~390 "pools", which is not liquidity
 * but a restatement of the price path: at that density every move sweeps
 * something and the signal means nothing. Equal highs, as traders use the
 * term, means equal swing highs.
 *
 * "Equal" is a tolerance rather than an exact match, because stops cluster
 * around a level, not on it.
 */
export function findLiquidityPools(
  candles: Candle[],
  swings: SwingPoint[],
  options: { tolerancePoints?: number; minTouches?: number } = {},
): LiquidityPool[] {
  const tolerancePoints = options.tolerancePoints ?? 2;
  const minTouches = options.minTouches ?? 2;
  const pools: LiquidityPool[] = [];

  const cluster = (kind: "high" | "low") => {
    const points = swings.filter((s) => s.kind === kind);
    const clusters: { price: number; index: number; time: number; touches: number }[] = [];

    for (const point of points) {
      const existing = clusters.find((c) => Math.abs(c.price - point.price) <= tolerancePoints);
      if (existing) {
        existing.touches += 1;
        // Keep the extreme of the cluster: that is where the stops sit.
        existing.price = kind === "high" ? Math.max(existing.price, point.price) : Math.min(existing.price, point.price);
        // A pool is only actionable once the swing that completed it is
        // confirmed, so carry the later index forward.
        existing.index = Math.max(existing.index, point.confirmedIndex);
        existing.time = candles[Math.min(existing.index, candles.length - 1)]?.time ?? point.time;
      } else {
        clusters.push({
          price: point.price,
          index: point.confirmedIndex,
          time: candles[Math.min(point.confirmedIndex, candles.length - 1)]?.time ?? point.time,
          touches: 1,
        });
      }
    }

    for (const c of clusters) {
      if (c.touches < minTouches) continue;
      pools.push({
        index: c.index,
        time: c.time,
        price: c.price,
        kind: kind === "high" ? "equal-highs" : "equal-lows",
        side: kind === "high" ? "buy-side" : "sell-side",
        touches: c.touches,
        sweptIndex: null,
      });
    }
  };

  cluster("high");
  cluster("low");

  return pools.sort((a, b) => a.index - b.index);
}

/**
 * A sweep is a wick through a liquidity pool that closes back inside it.
 *
 * The close is the whole point. Price trading through a level and staying
 * there is a break; going through it and rejecting is a raid on stops, and the
 * expected move is the other way.
 */
export function findSweeps(candles: Candle[], pools: LiquidityPool[]): LiquiditySweep[] {
  const sweeps: LiquiditySweep[] = [];

  for (const pool of pools) {
    for (let i = pool.index + 1; i < candles.length; i++) {
      const candle = candles[i];

      if (pool.side === "buy-side" && candle.high > pool.price && candle.close < pool.price) {
        pool.sweptIndex = i;
        sweeps.push({ index: i, time: candle.time, pool, direction: "bearish", penetration: candle.high - pool.price });
        break;
      }
      if (pool.side === "sell-side" && candle.low < pool.price && candle.close > pool.price) {
        pool.sweptIndex = i;
        sweeps.push({ index: i, time: candle.time, pool, direction: "bullish", penetration: pool.price - candle.low });
        break;
      }
    }
  }

  return sweeps.sort((a, b) => a.index - b.index);
}

/** Record the first bar that traded back into each zone. */
function markMitigation<T extends PriceZone>(zones: T[], candles: Candle[]): T[] {
  for (const zone of zones) {
    for (let i = zone.index + 1; i < candles.length; i++) {
      const candle = candles[i];
      if (candle.low <= zone.high && candle.high >= zone.low) {
        zone.mitigatedIndex = i;
        break;
      }
    }
  }
  return zones;
}

/** Zones that were still unmitigated as of `index` — the ones price has yet to revisit. */
export function unmitigatedAt<T extends PriceZone>(zones: T[], index: number): T[] {
  return zones.filter((z) => z.index <= index && (z.mitigatedIndex === null || z.mitigatedIndex > index));
}

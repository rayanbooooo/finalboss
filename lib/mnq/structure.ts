import type { Candle } from "@/types/market";

/**
 * Market structure: swing points, breaks of structure, and the dealing range.
 *
 * The one rule this module refuses to break is lookahead. A swing high is not
 * a swing high until `lookback` bars have closed to the right of it without
 * exceeding it, so `confirmedIndex` is always >= `index`. Backtests that treat
 * a swing as known at the moment it printed produce beautiful equity curves
 * that cannot be traded, because at that moment it was just a high.
 */

export type Direction = "bullish" | "bearish";
export type Trend = Direction | "ranging";

export interface SwingPoint {
  /** Bar index where the extreme actually printed. */
  index: number;
  time: number;
  price: number;
  kind: "high" | "low";
  /** Bar index at which this swing became knowable. Never less than `index`. */
  confirmedIndex: number;
}

export interface StructureEvent {
  /** Bar whose close broke the level. */
  index: number;
  time: number;
  /**
   * `bos` continues the prevailing trend; `choch` is the first break against
   * it and is the one that matters for reversal setups.
   */
  kind: "bos" | "choch";
  direction: Direction;
  /** Level that was taken, and the swing it belonged to. */
  price: number;
  brokenSwing: SwingPoint;
}

export interface DealingRange {
  low: number;
  high: number;
  /** Midpoint. Above is premium, below is discount. */
  equilibrium: number;
}

export interface StructureState {
  swings: SwingPoint[];
  events: StructureEvent[];
  trend: Trend;
  lastSwingHigh: SwingPoint | null;
  lastSwingLow: SwingPoint | null;
  dealingRange: DealingRange | null;
}

/**
 * Fractal swing detection.
 *
 * `lookback` bars either side must fail to exceed the candidate. Three is the
 * conventional ICT fractal and is what the default reflects; larger values
 * give fewer, more structural swings.
 */
export function findSwings(candles: Candle[], lookback = 3): SwingPoint[] {
  const swings: SwingPoint[] = [];
  if (candles.length < lookback * 2 + 1) return swings;

  for (let i = lookback; i < candles.length - lookback; i++) {
    const candle = candles[i];
    let isHigh = true;
    let isLow = true;

    for (let offset = 1; offset <= lookback; offset++) {
      const left = candles[i - offset];
      const right = candles[i + offset];
      // Ties count as a failure to exceed, so a flat double top yields one
      // swing rather than two adjacent ones that then both look "broken".
      if (left.high >= candle.high || right.high > candle.high) isHigh = false;
      if (left.low <= candle.low || right.low < candle.low) isLow = false;
    }

    if (isHigh) {
      swings.push({ index: i, time: candle.time, price: candle.high, kind: "high", confirmedIndex: i + lookback });
    }
    if (isLow) {
      swings.push({ index: i, time: candle.time, price: candle.low, kind: "low", confirmedIndex: i + lookback });
    }
  }

  return swings.sort((a, b) => a.index - b.index);
}

/**
 * Walk the series bar by bar, tracking trend and emitting BOS / CHoCH events.
 *
 * At each bar only swings already confirmed are considered, which is what
 * keeps this honest for both live use and backtesting.
 */
export function analyzeStructure(candles: Candle[], lookback = 3): StructureState {
  const swings = findSwings(candles, lookback);
  const events: StructureEvent[] = [];

  let trend: Trend = "ranging";
  let activeHigh: SwingPoint | null = null;
  let activeLow: SwingPoint | null = null;

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];

    // Promote any swing that becomes knowable on this bar.
    for (const swing of swings) {
      if (swing.confirmedIndex !== i) continue;
      if (swing.kind === "high") activeHigh = swing;
      else activeLow = swing;
    }

    // A break needs a close through the level, not just a wick. Wicks through
    // structure are liquidity sweeps, which zones.ts treats as a separate and
    // often opposite signal.
    if (activeHigh && candle.close > activeHigh.price) {
      const kind = trend === "bearish" ? "choch" : "bos";
      events.push({ index: i, time: candle.time, kind, direction: "bullish", price: activeHigh.price, brokenSwing: activeHigh });
      trend = "bullish";
      // The level is spent: keep it from firing again on every subsequent bar.
      activeHigh = null;
    } else if (activeLow && candle.close < activeLow.price) {
      const kind = trend === "bullish" ? "choch" : "bos";
      events.push({ index: i, time: candle.time, kind, direction: "bearish", price: activeLow.price, brokenSwing: activeLow });
      trend = "bearish";
      activeLow = null;
    }
  }

  const highs = swings.filter((s) => s.kind === "high");
  const lows = swings.filter((s) => s.kind === "low");
  const lastSwingHigh = highs.at(-1) ?? null;
  const lastSwingLow = lows.at(-1) ?? null;

  return {
    swings,
    events,
    trend,
    lastSwingHigh,
    lastSwingLow,
    dealingRange: buildDealingRange(lastSwingHigh, lastSwingLow),
  };
}

function buildDealingRange(high: SwingPoint | null, low: SwingPoint | null): DealingRange | null {
  if (!high || !low || high.price <= low.price) return null;
  return { low: low.price, high: high.price, equilibrium: (high.price + low.price) / 2 };
}

/** Where a price sits in the dealing range: 0 at the low, 1 at the high. */
export function rangePosition(price: number, range: DealingRange): number {
  const span = range.high - range.low;
  if (span <= 0) return 0.5;
  return (price - range.low) / span;
}

/**
 * Optimal Trade Entry: the 0.62–0.79 retracement of the dealing range.
 *
 * Longs want discount (below equilibrium), shorts want premium. Buying at a
 * premium is the single most common way a correct directional read still
 * loses, because the stop has to sit under the whole range to be valid.
 */
export function isOteZone(price: number, range: DealingRange, direction: Direction): boolean {
  const position = rangePosition(price, range);
  return direction === "bullish"
    ? position >= 0.21 && position <= 0.38
    : position >= 0.62 && position <= 0.79;
}

/** True when the price is on the correct side of equilibrium for the direction. */
export function isFavourablePricing(price: number, range: DealingRange, direction: Direction): boolean {
  const position = rangePosition(price, range);
  return direction === "bullish" ? position < 0.5 : position > 0.5;
}

/** The most recent structure event at or before `index`. */
export function structureAt(state: StructureState, index: number): StructureEvent | null {
  for (let i = state.events.length - 1; i >= 0; i--) {
    if (state.events[i].index <= index) return state.events[i];
  }
  return null;
}

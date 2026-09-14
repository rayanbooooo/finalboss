import { describe, expect, it } from "vitest";
import {
  DEMO_LEVERAGE_BOUNDS,
  MAX_LEVERAGE,
  MIN_LEVERAGE,
  calcLiquidationPrice,
  calcPnl,
  calcPnlPercent,
  calcPositionSize,
  calcSma,
  clampLeverage,
  leverageFromSliderValue,
  liquidationDistancePercent,
  liquidationProgress,
  priceMovePercent,
  sliderValueFromLeverage,
} from "@/lib/calculations";
import type { Candle } from "@/types/market";

const candles = (closes: number[]): Candle[] =>
  closes.map((close, i) => ({
    time: i * 60_000,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1,
  }));

describe("demo leverage range", () => {
  /**
   * 1000x is the product, not a tunable. A change that quietly lowers this
   * ceiling - or raises the floor off 500x - is a change to what FinalBoss
   * sells, so it fails here rather than shipping.
   *
   * This does NOT apply to a connected exchange account: a real venue caps
   * leverage per symbol and would reject anything near 1000x, so live mode
   * reads its bounds from the instrument instead of from these constants.
   */
  it("still spans 500x to 1000x", () => {
    expect(MIN_LEVERAGE).toBe(500);
    expect(MAX_LEVERAGE).toBe(1000);
    expect(DEMO_LEVERAGE_BOUNDS).toEqual({ min: 500, max: 1000 });
  });

  it("puts 1000x at the top of the slider and 500x at the bottom", () => {
    expect(leverageFromSliderValue(100)).toBe(1000);
    expect(leverageFromSliderValue(0)).toBe(500);
    expect(leverageFromSliderValue(50)).toBe(750);
  });

  it("round-trips through the slider", () => {
    for (const leverage of [500, 625, 750, 875, 1000]) {
      expect(leverageFromSliderValue(sliderValueFromLeverage(leverage))).toBe(leverage);
    }
  });

  it("pulls anything outside the range back into it", () => {
    expect(clampLeverage(10)).toBe(500);
    expect(clampLeverage(5000)).toBe(1000);
    expect(clampLeverage(Number.NaN)).toBe(500);
  });

  it("uses a venue's own bounds when given them", () => {
    const venue = { min: 1, max: 100 };
    expect(clampLeverage(1000, venue)).toBe(100);
    expect(leverageFromSliderValue(0, venue)).toBe(1);
    expect(leverageFromSliderValue(100, venue)).toBe(100);
  });
});

describe("liquidation distance", () => {
  /**
   * The brief: $50 from entry at 1000x, $100 at 500x, and every leverage in
   * between on the same curve. Both targets are the same share of margin, so
   * one constant satisfies both - these assertions are what prove that, at a
   * real BTC price rather than a round number.
   */
  const BTC = 77_200;

  it("liquidates a 1000x long about $50 below entry", () => {
    const liq = calcLiquidationPrice(BTC, 1000, "long");
    expect(BTC - liq).toBeCloseTo(50.18, 1);
  });

  it("liquidates a 500x long about $100 below entry", () => {
    const liq = calcLiquidationPrice(BTC, 500, "long");
    expect(BTC - liq).toBeCloseTo(100.36, 1);
  });

  it("mirrors the distance for a short", () => {
    const long = BTC - calcLiquidationPrice(BTC, 1000, "long");
    const short = calcLiquidationPrice(BTC, 1000, "short") - BTC;
    expect(short).toBeCloseTo(long, 6);
  });

  it("is the same percentage on every market", () => {
    for (const price of [77_200, 2_400, 180, 0.52, 0.11]) {
      const move = (price - calcLiquidationPrice(price, 1000, "long")) / price;
      expect(move).toBeCloseTo(0.00065, 9);
    }
  });

  it("halves the distance as leverage doubles", () => {
    const at500 = BTC - calcLiquidationPrice(BTC, 500, "long");
    const at1000 = BTC - calcLiquidationPrice(BTC, 1000, "long");
    expect(at500 / at1000).toBeCloseTo(2, 6);
  });

  /**
   * The invariant two earlier versions broke, in opposite directions: the
   * liquidation price must sit strictly between entry and a total loss of
   * margin. 0.65/leverage is below 1/leverage by construction, so this holds
   * at every leverage rather than being clamped into place.
   */
  it("never crosses entry or total loss of margin, at any leverage", () => {
    for (let leverage = 1; leverage <= 2000; leverage += 1) {
      const liq = calcLiquidationPrice(BTC, leverage, "long");
      expect(liq).toBeLessThan(BTC);
      expect(liq).toBeGreaterThan(BTC * (1 - 1 / leverage));
    }
  });

  it("reports zero distance for a nonsensical leverage rather than NaN", () => {
    expect(liquidationDistancePercent(0)).toBe(0);
    expect(liquidationDistancePercent(Number.NaN)).toBe(0);
  });
});

describe("position maths", () => {
  it("sizes a position from margin and leverage", () => {
    expect(calcPositionSize(100, 1000, 77_200)).toBeCloseTo(1.2953, 4);
    expect(calcPositionSize(100, 1000, 0)).toBe(0);
  });

  it("signs pnl by side", () => {
    expect(calcPnl(100, 110, 2, "long")).toBe(20);
    expect(calcPnl(100, 110, 2, "short")).toBe(-20);
  });

  it("reports pnl against margin, not notional", () => {
    // 0.065% of price at 1000x is 65% of the margin - the whole point of the
    // two being separate functions.
    const margin = 100;
    const size = calcPositionSize(margin, 1000, 77_200);
    const pnl = calcPnl(77_200, 77_200 * 1.00065, size, "long");
    expect(calcPnlPercent(pnl, margin)).toBeCloseTo(65, 1);
    expect(priceMovePercent(77_200, 77_200 * 1.00065)).toBeCloseTo(0.065, 6);
  });

  it("guards a zero margin", () => {
    expect(calcPnlPercent(10, 0)).toBe(0);
    expect(priceMovePercent(0, 100)).toBe(0);
  });
});

describe("liquidation progress", () => {
  const entry = 100;
  const liq = 90;

  it("is zero in profit and one at liquidation", () => {
    expect(liquidationProgress(entry, 110, liq, "long")).toBe(0);
    expect(liquidationProgress(entry, 90, liq, "long")).toBeCloseTo(1, 6);
  });

  it("is a half at the midpoint", () => {
    expect(liquidationProgress(entry, 95, liq, "long")).toBeCloseTo(0.5, 6);
  });

  /** A venue omits the liquidation price when a position cannot be liquidated,
   * which arrives as NaN and used to produce a NaN-width meter. */
  it("survives a missing liquidation price", () => {
    expect(liquidationProgress(entry, 95, Number.NaN, "long")).toBe(0);
    expect(liquidationProgress(entry, Number.NaN, liq, "long")).toBe(0);
  });
});

describe("calcSma", () => {
  it("is null until the window fills, then averages it", () => {
    const sma = calcSma(candles([1, 2, 3, 4, 5]), 3);
    expect(sma).toEqual([null, null, 2, 3, 4]);
  });

  it("returns one entry per candle", () => {
    expect(calcSma(candles([1, 2, 3]), 20)).toEqual([null, null, null]);
  });
});

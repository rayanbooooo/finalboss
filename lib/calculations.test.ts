import { describe, expect, it } from "vitest";
import {
  DEFAULT_LEVERAGE,
  FALLBACK_LEVERAGE_BOUNDS,
  VENUE_MAX_LEVERAGE,
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

describe("leverage", () => {
  /**
   * These constants used to encode demo mode: a range of 500x to 1000x that
   * exists at no venue this terminal can reach, with a test here asserting
   * that "1000x is the product". It was not - every order at those settings
   * would have been rejected. The range now comes from the venue, per symbol,
   * and what is left here is a starting point and a ceiling for copy.
   */
  it("starts a new trader somewhere a venue will accept", () => {
    expect(DEFAULT_LEVERAGE).toBeGreaterThanOrEqual(1);
    expect(DEFAULT_LEVERAGE).toBeLessThanOrEqual(VENUE_MAX_LEVERAGE);
  });

  it("keeps the advertised ceiling to what the venue actually offers", () => {
    // 200x is Aster's own limit on BTCUSDT. A headline claiming more is a
    // promise the product cannot keep, which is what 1000x was.
    expect(VENUE_MAX_LEVERAGE).toBe(200);
  });

  it("spans the venue's range on the slider", () => {
    const venue = { min: 1, max: 200 };
    expect(leverageFromSliderValue(0, venue)).toBe(1);
    expect(leverageFromSliderValue(100, venue)).toBe(200);
  });

  it("lands exactly on the ends, which are the values people reach for", () => {
    const venue = { min: 1, max: 200 };
    for (const leverage of [venue.min, venue.max]) {
      expect(leverageFromSliderValue(sliderValueFromLeverage(leverage, venue), venue)).toBe(
        leverage
      );
    }
  });

  it("round-trips within one slider step, and cannot do better", () => {
    // The slider has 101 integer positions. Over a 1-200 range that is a step
    // of about 2x, so not every leverage is addressable by dragging - 50x
    // comes back as 51x. This is a real limit of the control rather than a
    // rounding bug, and it is why the presets exist: they set exact values
    // the slider alone cannot reach.
    const venue = { min: 1, max: 200 };
    const step = (venue.max - venue.min) / 100;

    for (const leverage of [25, 50, 100, 150]) {
      const round = leverageFromSliderValue(sliderValueFromLeverage(leverage, venue), venue);
      expect(Math.abs(round - leverage)).toBeLessThanOrEqual(Math.ceil(step));
    }
  });

  it("is stable once round-tripped, so dragging does not drift", () => {
    // The property that actually matters: re-reading a value the slider
    // produced must give the same value back, or a leverage would creep every
    // time the component re-rendered.
    const venue = { min: 1, max: 200 };
    const once = leverageFromSliderValue(sliderValueFromLeverage(50, venue), venue);
    const twice = leverageFromSliderValue(sliderValueFromLeverage(once, venue), venue);
    expect(twice).toBe(once);
  });

  it("pulls anything outside the venue's range back into it", () => {
    const venue = { min: 1, max: 100 };
    expect(clampLeverage(1000, venue)).toBe(100);
    expect(clampLeverage(0, venue)).toBe(1);
    expect(clampLeverage(Number.NaN, venue)).toBe(1);
  });
});

describe("FALLBACK_LEVERAGE_BOUNDS", () => {
  it("stays inside what every venue permits", () => {
    // In force only until the instrument's real rules arrive, so it must never
    // itself be the reason an order is rejected.
    expect(FALLBACK_LEVERAGE_BOUNDS.min).toBeGreaterThanOrEqual(1);
    expect(FALLBACK_LEVERAGE_BOUNDS.max).toBeLessThanOrEqual(5);
  });

  it("pulls a leverage saved under demo mode into something tradeable", () => {
    // Profiles created before this change carry 500x and above.
    expect(clampLeverage(750, FALLBACK_LEVERAGE_BOUNDS)).toBe(FALLBACK_LEVERAGE_BOUNDS.max);
  });

  it("keeps liquidation between entry and total loss", () => {
    const entry = 77200;
    const liq = calcLiquidationPrice(entry, FALLBACK_LEVERAGE_BOUNDS.max, "long");
    expect(liq).toBeLessThan(entry);
    expect(liq).toBeGreaterThan(entry * (1 - 1 / FALLBACK_LEVERAGE_BOUNDS.max));
  });
});

import { describe, expect, it } from "vitest";
import { describeOrderError, roundQtyDown, sizeOrder, stepDecimals } from "@/lib/exchange/orders";
import { ExchangeError, type Instrument } from "@/lib/exchange/types";

const btc: Instrument = {
  symbol: "BTCUSDT",
  minLeverage: 1,
  maxLeverage: 100,
  leverageStep: 0.01,
  minQty: 0.001,
  qtyStep: 0.001,
  tickSize: 0.1,
};

const doge: Instrument = {
  symbol: "DOGEUSDT",
  minLeverage: 1,
  maxLeverage: 75,
  leverageStep: 0.01,
  minQty: 1,
  qtyStep: 1,
  tickSize: 0.00001,
};

describe("stepDecimals", () => {
  it("reads the places off a decimal step", () => {
    expect(stepDecimals(1)).toBe(0);
    expect(stepDecimals(0.1)).toBe(1);
    expect(stepDecimals(0.001)).toBe(3);
  });

  /** Bybit sends some steps in exponent notation, where counting characters
   * after the dot gives the wrong answer. */
  it("reads an exponent step", () => {
    expect(stepDecimals(1e-8)).toBe(8);
    expect(stepDecimals(1e-5)).toBe(5);
  });

  it("refuses to divide by a nonsense step", () => {
    expect(stepDecimals(0)).toBe(0);
    expect(stepDecimals(-1)).toBe(0);
    expect(stepDecimals(Number.NaN)).toBe(0);
  });
});

describe("roundQtyDown", () => {
  it("rounds down, never up", () => {
    // Up would ask for more than the margin covers.
    expect(roundQtyDown(0.0019, 0.001)).toBe(0.001);
    expect(roundQtyDown(1.999, 1)).toBe(1);
  });

  /**
   * The reason the implementation carries an epsilon: 0.3 / 0.1 is
   * 2.9999999999999996 in IEEE 754, so a plain floor silently drops a whole
   * step and the order goes in a third smaller than the user asked for.
   */
  it("does not lose a step to floating point", () => {
    expect(roundQtyDown(0.3, 0.1)).toBe(0.3);
    expect(roundQtyDown(0.7, 0.1)).toBe(0.7);
    expect(roundQtyDown(1.1, 0.1)).toBe(1.1);
    expect(roundQtyDown(29.7, 0.1)).toBe(29.7);
  });

  it("returns a value that is exact at the step's precision", () => {
    expect(roundQtyDown(1.23456789, 0.001)).toBe(1.234);
    expect(String(roundQtyDown(0.1 + 0.2, 0.001))).toBe("0.3");
  });

  it("handles nonsense input without returning NaN", () => {
    expect(roundQtyDown(0, 0.001)).toBe(0);
    expect(roundQtyDown(-1, 0.001)).toBe(0);
    expect(roundQtyDown(Number.NaN, 0.001)).toBe(0);
    expect(roundQtyDown(1.5, 0)).toBe(1.5);
  });
});

describe("sizeOrder", () => {
  it("turns margin and leverage into a quantity the venue accepts", () => {
    const { qty, notional } = sizeOrder(100, 10, 77_200, btc);
    // 100 * 10 / 77200 = 0.012953..., floored to the 0.001 step.
    expect(qty).toBe(0.012);
    expect(notional).toBeCloseTo(0.012 * 77_200, 6);
  });

  it("sizes a whole-unit symbol", () => {
    expect(sizeOrder(50, 10, 0.11, doge).qty).toBe(4545);
  });

  it("refuses an order below the venue's minimum, and says what it would take", () => {
    // 5 * 1 / 77200 is far under BTC's 0.001 minimum.
    expect(() => sizeOrder(5, 1, 77_200, btc)).toThrow(ExchangeError);
    expect(() => sizeOrder(5, 1, 77_200, btc)).toThrow(/minimum is 0\.001/);
    expect(() => sizeOrder(5, 1, 77_200, btc)).toThrow(/\$77\.20 of margin at 1x/);
  });

  it("refuses to size against a price it does not have", () => {
    expect(() => sizeOrder(100, 10, 0, btc)).toThrow(/No price available/);
    expect(() => sizeOrder(100, 10, Number.NaN, btc)).toThrow(/No price available/);
  });

  it("refuses an empty margin", () => {
    expect(() => sizeOrder(0, 10, 77_200, btc)).toThrow(/margin amount/);
    expect(() => sizeOrder(-5, 10, 77_200, btc)).toThrow(/margin amount/);
  });

  /**
   * The property that matters: whenever sizing succeeds, the resulting
   * notional is within what the margin buys. It can only ever round down, so
   * this must hold for every combination that clears the venue minimum.
   */
  it("never returns a quantity the margin cannot cover", () => {
    let checked = 0;
    for (const margin of [12, 47.5, 100, 999.99]) {
      for (const leverage of [1, 7, 25, 100]) {
        for (const instrument of [btc, doge]) {
          const price = instrument === btc ? 77_200 : 0.11;
          let sized;
          try {
            sized = sizeOrder(margin, leverage, price, instrument);
          } catch {
            // Below the venue's minimum - a refusal, not a bad quantity.
            continue;
          }
          expect(sized.notional).toBeLessThanOrEqual(margin * leverage + 1e-6);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(10);
  });
});

describe("describeOrderError", () => {
  it("translates the codes a user can act on", () => {
    expect(describeOrderError(110007, "")).toMatch(/available balance/);
    expect(describeOrderError(110017, "")).toMatch(/increase the position/);
    expect(describeOrderError(10005, "")).toMatch(/trade permission/);
    expect(describeOrderError(10006, "")).toMatch(/rate-limiting/);
  });

  it("names hedge mode on both codes that mean it", () => {
    expect(describeOrderError(110021, "")).toMatch(/hedge mode/);
    expect(describeOrderError(110024, "")).toMatch(/hedge mode/);
  });

  /** 10001 is the venue's catch-all, so only the message distinguishes a
   * position-mode mismatch - the one case in that bucket a user can fix. */
  it("finds hedge mode inside the catch-all code", () => {
    expect(describeOrderError(10001, "position idx not match position mode")).toMatch(
      /hedge mode/
    );
    expect(describeOrderError(10001, "positionIdx invalid")).toMatch(/hedge mode/);
  });

  it("passes the venue's own message through for anything else on 10001", () => {
    expect(describeOrderError(10001, "params error: xyz")).toBe(
      "The exchange rejected the order: params error: xyz"
    );
  });

  it("never returns an empty string", () => {
    expect(describeOrderError(999999, "")).toBe("The exchange rejected the order (code 999999).");
    expect(describeOrderError(999999, "Something specific")).toBe("Something specific");
  });
});

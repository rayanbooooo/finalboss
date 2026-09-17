import { describe, expect, it } from "vitest";

import {
  findSymbol,
  parseBalance,
  parseInstrument,
  parseMaxLeverage,
  parsePositions,
} from "@/lib/exchange/aster/account";

describe("parseBalance", () => {
  const rows = [
    { asset: "BNB", balance: "3.0", availableBalance: "3.0", crossUnPnl: "0.0" },
    { asset: "USDT", balance: "1000.5", availableBalance: "820.25", crossUnPnl: "-12.75" },
  ];

  it("picks USDT out of every asset the account holds", () => {
    expect(parseBalance(rows).availableBalance).toBe(820.25);
  });

  it("reports equity as wallet balance plus unrealised, matching Bybit's meaning", () => {
    // The UI shows one number in one place; it has to mean the same thing
    // whichever venue supplied it.
    expect(parseBalance(rows).totalEquity).toBeCloseTo(987.75, 6);
    expect(parseBalance(rows).unrealisedPnl).toBe(-12.75);
  });

  it("returns zeros rather than throwing when the account holds no USDT", () => {
    expect(parseBalance([{ asset: "BNB", balance: "3.0" }])).toEqual({
      coin: "USDT",
      totalEquity: 0,
      availableBalance: 0,
      unrealisedPnl: 0,
    });
  });

  it("survives a response that is not an array", () => {
    expect(parseBalance(null).totalEquity).toBe(0);
    expect(parseBalance({ code: -5050 }).totalEquity).toBe(0);
  });
});

describe("parsePositions", () => {
  const rows = [
    {
      symbol: "BTCUSDT",
      positionAmt: "0.500",
      entryPrice: "60000",
      markPrice: "61000",
      liquidationPrice: "55000",
      leverage: "20",
      isolatedMargin: "1500",
      unRealizedProfit: "500",
      updateTime: 1_700_000_000_000,
    },
    {
      symbol: "ETHUSDT",
      positionAmt: "-2.0",
      entryPrice: "3000",
      markPrice: "2950",
      liquidationPrice: "0",
      leverage: "10",
      isolatedMargin: "600",
      unRealizedProfit: "100",
      updateTime: 1_700_000_000_000,
    },
    { symbol: "SOLUSDT", positionAmt: "0", leverage: "5" },
  ];

  it("drops flat rows", () => {
    // Aster returns every symbol the account has touched, zero-size included.
    expect(parsePositions(rows).map((p) => p.symbol)).toEqual(["BTCUSDT", "ETHUSDT"]);
  });

  it("reads direction from the sign and reports a positive size", () => {
    const [long, short] = parsePositions(rows);

    expect(long.side).toBe("long");
    expect(long.size).toBe(0.5);
    expect(short.side).toBe("short");
    expect(short.size).toBe(2);
  });

  it("treats a zero liquidation price as absent", () => {
    // Rendered literally it reads as "liquidation at $0", which is alarming
    // and untrue.
    expect(parsePositions(rows)[1].liquidationPrice).toBeNull();
    expect(parsePositions(rows)[0].liquidationPrice).toBe(55000);
  });

  it("maps the rest of the row onto the terminal's shape", () => {
    const [position] = parsePositions(rows);

    expect(position).toMatchObject({
      entryPrice: 60000,
      markPrice: 61000,
      leverage: 20,
      margin: 1500,
      unrealisedPnl: 500,
      openedAt: 1_700_000_000_000,
    });
  });

  it("survives a response that is not an array", () => {
    expect(parsePositions(undefined)).toEqual([]);
  });
});

describe("parseMaxLeverage", () => {
  const brackets = [
    { bracket: 1, initialLeverage: 200, notionalCap: 10_000 },
    { bracket: 2, initialLeverage: 50, notionalCap: 100_000 },
  ];

  it("reads the array shape returned when no symbol is sent", () => {
    expect(parseMaxLeverage([{ symbol: "BTCUSDT", brackets }])).toBe(200);
  });

  it("reads the bare-object shape returned when a symbol IS sent", () => {
    // The trap: handling only the array works until the first narrowed call,
    // then fails as a type error rather than a venue error.
    expect(parseMaxLeverage({ symbol: "BTCUSDT", brackets })).toBe(200);
  });

  it("takes the highest bracket, which is the small-position ceiling", () => {
    expect(parseMaxLeverage({ symbol: "BTCUSDT", brackets })).toBe(200);
  });

  it("narrows to the requested symbol", () => {
    const response = [
      { symbol: "BTCUSDT", brackets: [{ initialLeverage: 200 }] },
      { symbol: "ETHUSDT", brackets: [{ initialLeverage: 75 }] },
    ];
    expect(parseMaxLeverage(response, "ETHUSDT")).toBe(75);
  });

  it("returns null rather than a plausible default when there is nothing to read", () => {
    expect(parseMaxLeverage([])).toBeNull();
    expect(parseMaxLeverage(null)).toBeNull();
    expect(parseMaxLeverage({ symbol: "BTCUSDT", brackets: [] })).toBeNull();
  });
});

describe("parseInstrument", () => {
  const info = {
    symbol: "BTCUSDT",
    filters: [
      { filterType: "PRICE_FILTER", tickSize: "0.10" },
      { filterType: "LOT_SIZE", minQty: "0.001", stepSize: "0.001" },
      { filterType: "MARKET_LOT_SIZE", minQty: "0.002", stepSize: "0.002" },
    ],
  };

  it("sizes against MARKET_LOT_SIZE, because every order here is a market order", () => {
    // Sizing against LOT_SIZE and then sending a market order is a rejection
    // naming a quantity the trader was told was allowed.
    const instrument = parseInstrument(info, 200);

    expect(instrument.minQty).toBe(0.002);
    expect(instrument.qtyStep).toBe(0.002);
  });

  it("falls back to LOT_SIZE when a venue omits the market filter", () => {
    // Not a preference: a missing step becomes zero, and roundQtyDown reads a
    // zero step as "no rounding" and sends the raw quantity to the venue.
    const withoutMarket = { ...info, filters: info.filters.slice(0, 2) };
    expect(parseInstrument(withoutMarket, 200).qtyStep).toBe(0.001);
  });

  it("takes leverage from the caller, since exchangeInfo has none", () => {
    expect(parseInstrument(info, 200).maxLeverage).toBe(200);
  });

  it("uses whole-number leverage steps", () => {
    // Aster takes an integer; a 0.01 step would offer values it rounds away.
    expect(parseInstrument(info, 200).leverageStep).toBe(1);
    expect(parseInstrument(info, 200).minLeverage).toBe(1);
  });

  it("never reports a max leverage below 1", () => {
    expect(parseInstrument(info, 0).maxLeverage).toBe(1);
  });

  it("reads the tick size", () => {
    expect(parseInstrument(info, 200).tickSize).toBe(0.1);
  });
});

describe("findSymbol", () => {
  const exchangeInfo = { symbols: [{ symbol: "BTCUSDT" }, { symbol: "ETHUSDT" }] };

  it("finds a symbol", () => {
    expect(findSymbol(exchangeInfo, "ETHUSDT")).toEqual({ symbol: "ETHUSDT" });
  });

  it("returns null for an unknown symbol or a malformed response", () => {
    expect(findSymbol(exchangeInfo, "DOGEUSDT")).toBeNull();
    expect(findSymbol(null, "BTCUSDT")).toBeNull();
  });
});

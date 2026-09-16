import { describe, expect, it } from "vitest";

import {
  ASTER_PATHS,
  asterSide,
  balanceCall,
  closeCall,
  leverageBracketCall,
  orderCall,
  positionRiskCall,
  setLeverageCall,
} from "@/lib/exchange/aster/requests";
import type { AsterAgentAuth } from "@/lib/exchange/aster/signing";

const AUTH: AsterAgentAuth = {
  signer: "0xC98Fd64eBc39E28b92849d9cCef9495663439014",
  nonce: 1_700_000_000_000_000,
};

const params = (payload: string) =>
  Object.fromEntries(payload.split("&").map((pair) => pair.split("=") as [string, string]));

describe("asterSide", () => {
  it("translates the terminal's vocabulary to the venue's", () => {
    expect(asterSide("long")).toBe("BUY");
    expect(asterSide("short")).toBe("SELL");
  });
});

describe("orderCall", () => {
  it("posts a market order to the documented path", () => {
    const call = orderCall({ symbol: "BTCUSDT", side: "long", quantity: 0.01 }, AUTH, "mainnet");

    expect(call.method).toBe("POST");
    expect(call.path).toBe("/fapi/v3/order");
    expect(params(call.request.payloadString)).toMatchObject({
      symbol: "BTCUSDT",
      side: "BUY",
      type: "MARKET",
      quantity: "0.01",
    });
  });

  it("omits reduceOnly on an opening order rather than sending false", () => {
    // The signature covers every parameter present, so omitting and sending
    // "false" are different signed strings. Aster's own example omits it.
    const call = orderCall({ symbol: "BTCUSDT", side: "long", quantity: 0.01 }, AUTH, "mainnet");
    expect(call.request.payloadString).not.toContain("reduceOnly");
  });

  it("sends reduceOnly as a string when set", () => {
    const call = orderCall(
      { symbol: "BTCUSDT", side: "long", quantity: 0.01, reduceOnly: true },
      AUTH,
      "mainnet"
    );
    expect(params(call.request.payloadString).reduceOnly).toBe("true");
  });

  it("carries auth in the documented order", () => {
    const call = orderCall({ symbol: "ETHUSDT", side: "short", quantity: 2 }, AUTH, "mainnet");

    expect(call.request.entries.map(([key]) => key)).toEqual([
      "symbol",
      "side",
      "type",
      "quantity",
      "nonce",
      "signer",
    ]);
  });

  it("signs exactly what it transmits", () => {
    const call = orderCall({ symbol: "BTCUSDT", side: "long", quantity: 0.01 }, AUTH, "mainnet");
    expect(call.request.typedData.message.msg).toBe(call.request.payloadString);
  });
});

describe("closeCall", () => {
  it("closes a long by selling, reduce-only", () => {
    const call = closeCall("BTCUSDT", "long", 0.01, AUTH, "mainnet");
    const sent = params(call.request.payloadString);

    expect(sent.side).toBe("SELL");
    expect(sent.reduceOnly).toBe("true");
  });

  it("closes a short by buying", () => {
    const call = closeCall("BTCUSDT", "short", 0.01, AUTH, "mainnet");
    expect(params(call.request.payloadString).side).toBe("BUY");
  });
});

describe("account reads", () => {
  it("reads balances with auth alone", () => {
    const call = balanceCall(AUTH, "mainnet");

    expect(call.method).toBe("GET");
    expect(call.path).toBe("/fapi/v3/balance");
    expect(call.request.entries.map(([key]) => key)).toEqual(["nonce", "signer"]);
  });

  it("reads every position when no symbol is given", () => {
    const call = positionRiskCall(AUTH, "mainnet");

    expect(call.path).toBe("/fapi/v3/positionRisk");
    expect(call.request.payloadString).not.toContain("symbol");
  });

  it("narrows to one symbol when asked", () => {
    const call = positionRiskCall(AUTH, "mainnet", "BTCUSDT");
    expect(params(call.request.payloadString).symbol).toBe("BTCUSDT");
  });
});

describe("setLeverageCall", () => {
  it("sends an integer leverage", () => {
    // "10.0" is a different signed string than "10", and the reference types
    // this parameter INT.
    const call = setLeverageCall("BTCUSDT", 10.7, AUTH, "mainnet");

    expect(call.method).toBe("POST");
    expect(params(call.request.payloadString).leverage).toBe("10");
  });

  it("does not impose a ceiling of its own", () => {
    // The venue decides, per symbol, via leverageBracket. This builder must not
    // quietly clamp a caller to a number read out of a doc comment.
    const call = setLeverageCall("BTCUSDT", 1001, AUTH, "mainnet");
    expect(params(call.request.payloadString).leverage).toBe("1001");
  });
});

describe("leverageBracketCall", () => {
  it("reads the venue's real ceiling for a symbol", () => {
    const call = leverageBracketCall(AUTH, "mainnet", "BTCUSDT");

    expect(call.method).toBe("GET");
    expect(call.path).toBe("/fapi/v3/leverageBracket");
    expect(params(call.request.payloadString).symbol).toBe("BTCUSDT");
  });
});

describe("ASTER_PATHS", () => {
  it("matches the documented V3 paths", () => {
    expect(ASTER_PATHS).toMatchObject({
      order: "/fapi/v3/order",
      balance: "/fapi/v3/balance",
      positionRisk: "/fapi/v3/positionRisk",
      leverage: "/fapi/v3/leverage",
      leverageBracket: "/fapi/v3/leverageBracket",
      exchangeInfo: "/fapi/v3/exchangeInfo",
    });
  });
});

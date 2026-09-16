import { describe, expect, it } from "vitest";

import {
  isAllowedPath,
  parseVenue,
  resolveUpstream,
  takesBrokerHeader,
} from "@/lib/exchange/routing";

describe("parseVenue", () => {
  it("accepts the venues this terminal routes for", () => {
    expect(parseVenue("bybit")).toBe("bybit");
    expect(parseVenue("aster")).toBe("aster");
  });

  it("refuses anything else rather than defaulting", () => {
    // A relay that defaults an unknown venue sends the request somewhere the
    // caller did not ask for, which is worse than refusing.
    for (const value of ["binance", "", "BYBIT", null, undefined, 1, {}]) {
      expect(parseVenue(value)).toBeNull();
    }
  });
});

describe("isAllowedPath", () => {
  it("allows the Bybit paths this terminal uses", () => {
    expect(isAllowedPath("bybit", "/v5/order/create")).toBe(true);
    expect(isAllowedPath("bybit", "/v5/market/instruments-info")).toBe(true);
  });

  it("allows Aster V3 paths", () => {
    expect(isAllowedPath("aster", "/fapi/v3/order")).toBe(true);
    expect(isAllowedPath("aster", "/fapi/v3/positionRisk")).toBe(true);
  });

  it("refuses Aster's legacy V1 endpoints", () => {
    // Aster stopped issuing V1 keys in March 2026, so a V3 agent signature
    // could never authenticate there - allowing it widens the relay's reach
    // in exchange for nothing.
    expect(isAllowedPath("aster", "/fapi/v1/order")).toBe(false);
  });

  it("does not let one venue reach the other's paths", () => {
    expect(isAllowedPath("aster", "/v5/order/create")).toBe(false);
    expect(isAllowedPath("bybit", "/fapi/v3/order")).toBe(false);
  });

  it("rejects traversal rather than normalising it", () => {
    expect(isAllowedPath("aster", "/fapi/v3/../../admin")).toBe(false);
    expect(isAllowedPath("bybit", "/v5/order/../../secret")).toBe(false);
  });

  it("rejects a path that only contains an allowed prefix later on", () => {
    expect(isAllowedPath("aster", "/evil/fapi/v3/order")).toBe(false);
    expect(isAllowedPath("bybit", "/evil/v5/order/create")).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isAllowedPath("aster", undefined as unknown as string)).toBe(false);
  });
});

describe("resolveUpstream", () => {
  it("builds an absolute URL from the venue's own table", () => {
    expect(resolveUpstream("aster", false, "/fapi/v3/order", "symbol=BTCUSDT")).toBe(
      "https://fapi.asterdex.com/fapi/v3/order?symbol=BTCUSDT"
    );
    expect(resolveUpstream("bybit", false, "/v5/order/create", "")).toBe(
      "https://api.bybit.com/v5/order/create"
    );
  });

  it("selects the testnet host from the same table", () => {
    expect(resolveUpstream("aster", true, "/fapi/v3/balance", "")).toBe(
      "https://fapi.asterdex-testnet.com/fapi/v3/balance"
    );
    expect(resolveUpstream("bybit", true, "/v5/account/wallet-balance", "")).toBe(
      "https://api-testnet.bybit.com/v5/account/wallet-balance"
    );
  });

  it("omits the question mark when there is no query", () => {
    expect(resolveUpstream("aster", false, "/fapi/v3/balance", "")).not.toContain("?");
  });

  it("returns null for a disallowed path instead of a URL", () => {
    expect(resolveUpstream("aster", false, "/fapi/v1/order", "")).toBeNull();
    expect(resolveUpstream("bybit", false, "/v5/asset/withdraw", "")).toBeNull();
  });

  it("always targets a host from the table, whatever the query says", () => {
    // The query is caller-controlled and goes nowhere near host selection.
    const url = resolveUpstream("aster", false, "/fapi/v3/order", "x=https://evil.example");
    expect(url?.startsWith("https://fapi.asterdex.com/")).toBe(true);
  });
});

describe("takesBrokerHeader", () => {
  it("is Bybit only", () => {
    // On Aster the equivalent is a signed order parameter the relay cannot
    // add, so there is nothing for it to attach.
    expect(takesBrokerHeader("bybit")).toBe(true);
    expect(takesBrokerHeader("aster")).toBe(false);
  });
});

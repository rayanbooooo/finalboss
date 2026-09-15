import { describe, expect, it } from "vitest";
import { approvalCeiling, attachBuilder, readBuilderConfig } from "./builder";

const ADDRESS = "0x014c85ffb0fF2F2972237AA950B452f92C69Ae1D";

describe("readBuilderConfig", () => {
  it("reads a complete configuration", () => {
    expect(readBuilderConfig(ADDRESS, "0.00001")).toEqual({
      address: ADDRESS,
      feeRate: "0.00001",
    });
  });

  it("trims whitespace", () => {
    expect(readBuilderConfig(`  ${ADDRESS}  `, " 0.00001 ")).toEqual({
      address: ADDRESS,
      feeRate: "0.00001",
    });
  });

  it("treats a half-configured deployment as unconfigured", () => {
    // The failure this guards against is silent: an address with no rate, or a
    // rate with nothing to credit, both place orders that look fine and earn
    // nothing.
    expect(readBuilderConfig(ADDRESS, null)).toBeNull();
    expect(readBuilderConfig(ADDRESS, "")).toBeNull();
    expect(readBuilderConfig(null, "0.00001")).toBeNull();
    expect(readBuilderConfig("", "0.00001")).toBeNull();
    expect(readBuilderConfig(undefined, undefined)).toBeNull();
  });

  it("rejects a malformed address", () => {
    expect(readBuilderConfig("0x123", "0.00001")).toBeNull();
    expect(readBuilderConfig(ADDRESS.slice(2), "0.00001")).toBeNull();
    expect(readBuilderConfig(`${ADDRESS}ff`, "0.00001")).toBeNull();
    expect(readBuilderConfig("not-an-address", "0.00001")).toBeNull();
  });

  it("rejects a fee rate that would earn nothing or cannot be signed", () => {
    expect(readBuilderConfig(ADDRESS, "0")).toBeNull();
    expect(readBuilderConfig(ADDRESS, "-0.1")).toBeNull();
    // Exponential notation is rejected upstream, so it must not pass here.
    expect(readBuilderConfig(ADDRESS, "1e-7")).toBeNull();
    expect(readBuilderConfig(ADDRESS, "abc")).toBeNull();
  });
});

describe("attachBuilder", () => {
  const order = { symbol: "BTCUSDT", side: "BUY", type: "MARKET", quantity: "0.03" };

  it("adds builder and feeRate when configured", () => {
    const config = readBuilderConfig(ADDRESS, "0.00001");
    expect(attachBuilder(order, config)).toEqual({
      ...order,
      builder: ADDRESS,
      feeRate: "0.00001",
    });
  });

  it("leaves the order untouched when unconfigured", () => {
    // An unconfigured deployment must still be able to trade.
    expect(attachBuilder(order, null)).toEqual(order);
    expect(attachBuilder(order, null)).not.toHaveProperty("builder");
    expect(attachBuilder(order, null)).not.toHaveProperty("feeRate");
  });

  it("does not mutate the order it is given", () => {
    const config = readBuilderConfig(ADDRESS, "0.00001");
    attachBuilder(order, config);
    expect(order).not.toHaveProperty("builder");
  });
});

describe("approvalCeiling", () => {
  it("leaves headroom above the charged rate", () => {
    const config = readBuilderConfig(ADDRESS, "0.00001")!;
    expect(approvalCeiling(config)).toBe("0.00002");
  });

  it("never produces exponential notation", () => {
    // 0.0000001 * 2 is 2e-7 via String(), which Aster rejects.
    const config = readBuilderConfig(ADDRESS, "0.0000001")!;
    expect(approvalCeiling(config)).not.toContain("e");
    expect(Number(approvalCeiling(config))).toBeCloseTo(0.0000002, 10);
  });

  it("stays above the rate it authorises", () => {
    const config = readBuilderConfig(ADDRESS, "0.00025")!;
    expect(Number(approvalCeiling(config))).toBeGreaterThan(Number(config.feeRate));
  });
});

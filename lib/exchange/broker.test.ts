import { describe, expect, it } from "vitest";
import { BROKER_HEADER, buildUpstreamHeaders } from "@/lib/exchange/broker";

describe("buildUpstreamHeaders", () => {
  const signed = {
    "x-bapi-api-key": "KEY",
    "x-bapi-timestamp": "1700000000000",
    "x-bapi-recv-window": "5000",
    "x-bapi-sign": "abc123",
    "content-type": "application/json",
  };

  it("forwards the signed Bybit headers", () => {
    const headers = buildUpstreamHeaders(signed);
    expect(headers.get("x-bapi-api-key")).toBe("KEY");
    expect(headers.get("x-bapi-sign")).toBe("abc123");
    expect(headers.get("content-type")).toBe("application/json");
  });

  it("drops anything not on the allowlist", () => {
    const headers = buildUpstreamHeaders({
      ...signed,
      cookie: "session=secret",
      authorization: "Bearer leak",
      host: "evil.example",
    });
    expect(headers.get("cookie")).toBeNull();
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("host")).toBeNull();
  });

  describe("broker attribution", () => {
    /** The normal case until Bybit approves a broker account. An empty header
     * is not an error Bybit reports, so it must not be sent at all. */
    it("sends no header when there is no broker id", () => {
      expect(buildUpstreamHeaders(signed).get(BROKER_HEADER)).toBeNull();
      expect(buildUpstreamHeaders(signed, null).get(BROKER_HEADER)).toBeNull();
      expect(buildUpstreamHeaders(signed, undefined).get(BROKER_HEADER)).toBeNull();
      expect(buildUpstreamHeaders(signed, "   ").get(BROKER_HEADER)).toBeNull();
    });

    it("attaches the broker id when there is one", () => {
      expect(buildUpstreamHeaders(signed, "api.finalboss").get(BROKER_HEADER)).toBe(
        "api.finalboss"
      );
    });

    /**
     * The one that actually matters. This header says whose volume it is. A
     * caller sending their own must never reach Bybit, or anyone could point
     * our users' trades at their own broker account.
     */
    it("never lets a caller set or override the broker id", () => {
      const hijack = { ...signed, "x-referer": "api.attacker", "X-Referer": "api.attacker" };
      expect(buildUpstreamHeaders(hijack).get(BROKER_HEADER)).toBeNull();
      expect(buildUpstreamHeaders(hijack, "api.finalboss").get(BROKER_HEADER)).toBe(
        "api.finalboss"
      );
    });
  });
});

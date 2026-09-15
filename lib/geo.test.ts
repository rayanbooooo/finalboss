import { describe, expect, it } from "vitest";
import { isRestricted, normaliseCountry, restrictionFor, RESTRICTED_TERRITORIES } from "./geo";

describe("normaliseCountry", () => {
  it("upper-cases and trims", () => {
    expect(normaliseCountry(" be ")).toBe("BE");
    expect(normaliseCountry("gb")).toBe("GB");
  });

  it("returns null for anything that is not a two-letter code", () => {
    expect(normaliseCountry(null)).toBeNull();
    expect(normaliseCountry(undefined)).toBeNull();
    expect(normaliseCountry("")).toBeNull();
    expect(normaliseCountry("BEL")).toBeNull();
    expect(normaliseCountry("B1")).toBeNull();
  });
});

describe("restrictionFor", () => {
  it("blocks territories Aster's own terms prohibit", () => {
    expect(restrictionFor("US")?.reason).toBe("venue");
    expect(restrictionFor("GB")?.reason).toBe("venue");
    expect(restrictionFor("CA")?.reason).toBe("venue");
  });

  it("blocks Belgium for distribution, not for the venue", () => {
    // Aster does not name Belgium. This one is ours: Belgium bans distributing
    // leveraged OTC derivatives to retail outright, and it is where this is
    // operated from.
    const restriction = restrictionFor("BE");
    expect(restriction?.reason).toBe("distribution");
  });

  it("allows territories on neither list", () => {
    expect(restrictionFor("DE")).toBeNull();
    expect(restrictionFor("AE")).toBeNull();
    expect(restrictionFor("BR")).toBeNull();
  });

  it("allows an unknown country", () => {
    // Deliberate, and the reasoning is in geo.ts: the header is absent locally,
    // in previews, and behind infrastructure that strips it. Failing closed
    // would disable the product for far more people than it protects, and
    // Aster geo-blocks independently one layer down.
    expect(restrictionFor(null)).toBeNull();
    expect(restrictionFor(undefined)).toBeNull();
    expect(restrictionFor("")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(restrictionFor("be")).not.toBeNull();
    expect(restrictionFor(" gb ")).not.toBeNull();
  });
});

describe("isRestricted", () => {
  it("agrees with restrictionFor", () => {
    expect(isRestricted("US")).toBe(true);
    expect(isRestricted("BE")).toBe(true);
    expect(isRestricted("DE")).toBe(false);
    expect(isRestricted(null)).toBe(false);
  });
});

describe("RESTRICTED_TERRITORIES", () => {
  it("uses uppercase ISO 3166-1 alpha-2 keys throughout", () => {
    Object.keys(RESTRICTED_TERRITORIES).forEach((code) => {
      expect(code).toMatch(/^[A-Z]{2}$/);
    });
  });

  it("gives every entry a reason the user can be shown", () => {
    Object.values(RESTRICTED_TERRITORIES).forEach((restriction) => {
      expect(restriction.detail.length).toBeGreaterThan(0);
    });
  });
});

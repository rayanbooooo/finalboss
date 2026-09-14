import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * These reload the module per case because the referral code is read once at
 * module scope - that is deliberate (it cannot change at runtime) but it means
 * a test that sets the env after import would be testing nothing.
 */
async function load(code?: string) {
  vi.resetModules();
  if (code === undefined) delete process.env.NEXT_PUBLIC_BYBIT_REFERRAL_CODE;
  else process.env.NEXT_PUBLIC_BYBIT_REFERRAL_CODE = code;
  return import("@/lib/venues");
}

const original = process.env.NEXT_PUBLIC_BYBIT_REFERRAL_CODE;
beforeEach(() => vi.resetModules());
afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_BYBIT_REFERRAL_CODE;
  else process.env.NEXT_PUBLIC_BYBIT_REFERRAL_CODE = original;
});

describe("with no referral code configured", () => {
  it("links straight to the exchange", async () => {
    const { venueSignUpUrl, ACTIVE_VENUE, hasReferral } = await load();
    expect(hasReferral()).toBe(false);
    expect(venueSignUpUrl()).toBe(ACTIVE_VENUE.signUpUrl);
  });

  /** The failure that would actually cost money: a placeholder or an empty
   * `ref=` looks like it is working and attributes every signup to nobody. */
  it("adds no empty ref parameter", async () => {
    const { venueSignUpUrl } = await load();
    expect(venueSignUpUrl()).not.toContain("ref=");
  });

  it("treats whitespace as absent", async () => {
    const { hasReferral, venueSignUpUrl } = await load("   ");
    expect(hasReferral()).toBe(false);
    expect(venueSignUpUrl()).not.toContain("ref=");
  });
});

describe("with a referral code configured", () => {
  it("attaches it to the sign-up link", async () => {
    const { venueSignUpUrl, hasReferral } = await load("FINALBOSS");
    expect(hasReferral()).toBe(true);
    expect(new URL(venueSignUpUrl()).searchParams.get("ref")).toBe("FINALBOSS");
  });

  it("keeps the link on the exchange's own host", async () => {
    const { venueSignUpUrl, ACTIVE_VENUE } = await load("FINALBOSS");
    expect(new URL(venueSignUpUrl()).host).toBe(new URL(ACTIVE_VENUE.signUpUrl).host);
  });

  it("preserves an existing query string", async () => {
    const { referralUrl } = await load("FINALBOSS");
    const out = new URL(referralUrl("https://www.bybit.com/register?affiliate_id=7&x=1"));
    expect(out.searchParams.get("affiliate_id")).toBe("7");
    expect(out.searchParams.get("x")).toBe("1");
    expect(out.searchParams.get("ref")).toBe("FINALBOSS");
  });

  it("replaces rather than duplicates an existing ref", async () => {
    const { referralUrl } = await load("FINALBOSS");
    const out = referralUrl("https://www.bybit.com/register?ref=SOMEONEELSE");
    expect(out.match(/ref=/g)).toHaveLength(1);
    expect(new URL(out).searchParams.get("ref")).toBe("FINALBOSS");
  });

  it("encodes a code that would otherwise break the query", async () => {
    const { referralUrl } = await load("a&b=c");
    const out = referralUrl("https://www.bybit.com/register");
    expect(new URL(out).searchParams.get("ref")).toBe("a&b=c");
  });

  it("returns a malformed base unchanged rather than inventing a URL", async () => {
    const { referralUrl } = await load("FINALBOSS");
    expect(referralUrl("not a url")).toBe("not a url");
  });
});

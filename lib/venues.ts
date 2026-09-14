/**
 * The exchanges this terminal can point people at, and how we get paid when
 * it does.
 *
 * Every real order placed here executes on a third-party venue, so this site
 * sends users to that venue constantly - to open an account, to create an API
 * key, to move funds. Until now it sent them anonymously, which meant handing
 * an exchange a funded, active trader for nothing.
 *
 * WHY BYBIT AND NOT A HIGHER-LEVERAGE VENUE
 *
 * The obvious objection is that Bybit caps around 100x while MEXC goes to 500x
 * and Aark advertises 1000x. The deciding fact is not leverage, it is whether
 * the venue pays on API order flow, which is the only kind this product
 * generates:
 *
 *   Bybit - "trading volume through API is included in the affiliate program"
 *   MEXC  - "all trades made by users via API will not count toward commission"
 *
 * So MEXC at 500x would pay nothing on a single trade placed through this
 * terminal. Aark has no integrator programme at all, publishes terms last
 * updated in 2022 that say it "does not receive fees", and its liquidity pool
 * was drained in an exploit. Leverage is worth nothing if the venue cannot pay
 * and cannot fill.
 *
 * 1000x stays where it has always been: demo, on live prices, where nobody's
 * money is at risk. No venue that charges real fees on real notional can offer
 * it - at 1000x a normal 0.055% taker fee is 55% of the margin per side.
 */

export interface Venue {
  id: string;
  name: string;
  /** Max leverage the venue actually allows, for copy only. The real bound is
   * always read per-symbol from the instrument - see lib/exchange/types.ts. */
  approxMaxLeverage: number;
  /** Where to send someone who has no account yet. */
  signUpUrl: string;
  /** Where an existing user manages their balance. */
  fundsUrl: string;
  /** Where an existing user creates an API key. */
  apiKeyUrl: string;
}

/**
 * Our referral code, from the environment rather than the source.
 *
 * Absent by default: a missing code must degrade to a plain link to the
 * exchange, never to a broken URL or a placeholder that silently attributes
 * signups to nobody. NEXT_PUBLIC_ because the links are rendered client-side,
 * and a referral code is public by nature - it is in the URL either way.
 */
const REFERRAL_CODE = process.env.NEXT_PUBLIC_BYBIT_REFERRAL_CODE?.trim() || null;

export const BYBIT: Venue = {
  id: "bybit",
  name: "Bybit",
  approxMaxLeverage: 100,
  signUpUrl: "https://www.bybit.com/register",
  fundsUrl: "https://www.bybit.com/user/assets/home",
  apiKeyUrl: "https://www.bybit.com/app/user/api-management",
};

/** The venue every real order currently routes to. */
export const ACTIVE_VENUE = BYBIT;

/** True when a referral code is configured, so the UI knows whether it owes
 * the reader a disclosure. */
export const hasReferral = (): boolean => REFERRAL_CODE !== null;

/**
 * Adds our referral code to a venue URL, if we have one.
 *
 * Built with URL rather than string concatenation so a link that already
 * carries a query string keeps it, and so a malformed base can never produce
 * something that looks like a link to a different host.
 */
export function referralUrl(url: string): string {
  if (!REFERRAL_CODE) return url;
  try {
    const parsed = new URL(url);
    // Bybit reads the referral from `ref`. Keep this per-venue if a second
    // exchange is ever added - they do not agree on the parameter name.
    parsed.searchParams.set("ref", REFERRAL_CODE);
    return parsed.toString();
  } catch {
    return url;
  }
}

/** Sign-up link carrying our code when one is configured. */
export const venueSignUpUrl = (): string => referralUrl(ACTIVE_VENUE.signUpUrl);

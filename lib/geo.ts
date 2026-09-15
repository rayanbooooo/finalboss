/**
 * Where Real mode may not be offered.
 *
 * Two separate reasons land in one list, and it is worth keeping them
 * distinguishable because they can move independently:
 *
 * 1. **The venue prohibits it.** Aster's terms bar the United States, Canada,
 *    the United Kingdom, China, North Korea, Russia, Ukraine, Cuba, Iran,
 *    Venezuela and Syria, plus comprehensively sanctioned jurisdictions.
 *    Routing a prohibited user is a breach of the agreement the builder
 *    account depends on - the account being the entire revenue model.
 *
 * 2. **We may not distribute it.** Belgium's Royal Decree of 18 August 2016
 *    bans distributing leveraged OTC derivatives to retail clients outright -
 *    an absolute bar even for MiFID-passported firms, and the only total ban
 *    of its kind in Europe. It also bans "inappropriate forms of remuneration
 *    as rewards for distributing these kinds of products", which is what a
 *    builder fee is. Spain's CNMV has separately classified perpetual futures
 *    as CFDs, so treating perps as in-scope is the regulator's own reading,
 *    not a cautious one.
 *
 * Demo mode is NOT gated by this. Simulated funds against a public price feed
 * are not a leveraged derivative, and gating them would break the one thing
 * the site does that is unambiguously fine everywhere.
 */

/** Why a territory is restricted. Both block Real mode; they differ in who
 *  imposed it and therefore in what would lift it. */
export type RestrictionReason = "venue" | "distribution";

export interface Restriction {
  reason: RestrictionReason;
  /** Shown to the user. Plain, not apologetic, and never implies they did
   *  something wrong - the restriction is ours and the venue's, not theirs. */
  detail: string;
}

const VENUE_DETAIL =
  "Aster, the exchange this terminal routes orders to, does not accept traders from your region.";

const DISTRIBUTION_DETAIL =
  "Leveraged derivatives may not be distributed to retail clients in your region.";

/**
 * ISO 3166-1 alpha-2, uppercase.
 *
 * Deliberately a plain map rather than a clever hierarchy: this list is read
 * by a compliance-minded human far more often than by the program, and the
 * reason for each row has to survive being skimmed.
 */
export const RESTRICTED_TERRITORIES: Readonly<Record<string, Restriction>> = {
  // Named in Aster's terms.
  US: { reason: "venue", detail: VENUE_DETAIL },
  CA: { reason: "venue", detail: VENUE_DETAIL },
  GB: { reason: "venue", detail: VENUE_DETAIL },
  CN: { reason: "venue", detail: VENUE_DETAIL },
  KP: { reason: "venue", detail: VENUE_DETAIL },
  RU: { reason: "venue", detail: VENUE_DETAIL },
  UA: { reason: "venue", detail: VENUE_DETAIL },
  CU: { reason: "venue", detail: VENUE_DETAIL },
  IR: { reason: "venue", detail: VENUE_DETAIL },
  VE: { reason: "venue", detail: VENUE_DETAIL },
  SY: { reason: "venue", detail: VENUE_DETAIL },

  // Ours, not the venue's. Belgium is where this is operated from, which makes
  // it the jurisdiction most likely to actually enforce against it.
  BE: { reason: "distribution", detail: DISTRIBUTION_DETAIL },
} as const;

/**
 * The country header Vercel attaches at the edge. Not spoofable by the page,
 * but trivially spoofable by anyone crafting their own request - so this is a
 * good-faith gate, not a security control. Real compliance needs the check to
 * also exist at the venue, which it does: Aster geo-blocks independently.
 */
export const COUNTRY_HEADER = "x-vercel-ip-country";

/** Normalises whatever arrives to a comparable code. Returns null rather than
 *  guessing: an unknown country is handled by policy below, not by coercion. */
export function normaliseCountry(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

/**
 * Whether Real mode may be offered.
 *
 * An unknown country is ALLOWED. That is the deliberate choice and it deserves
 * its reasoning: the header is absent in local development, in preview builds,
 * and for any request that did not traverse Vercel's edge. Failing closed there
 * would make Real mode untestable and would silently disable the product for
 * anyone behind infrastructure that strips the header, which is a much larger
 * population than the restricted territories. Aster performs its own geo-block
 * at the venue, so an unknown-country user who is in fact restricted is stopped
 * one layer down rather than not at all.
 */
export function restrictionFor(country: string | null | undefined): Restriction | null {
  const code = normaliseCountry(country);
  if (code === null) return null;
  return RESTRICTED_TERRITORIES[code] ?? null;
}

export function isRestricted(country: string | null | undefined): boolean {
  return restrictionFor(country) !== null;
}

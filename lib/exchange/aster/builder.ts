/**
 * Aster Code builder attribution - how routed volume becomes revenue.
 *
 * This is the Aster counterpart of `lib/exchange/broker.ts`, and it differs
 * from it in one way that matters architecturally.
 *
 * For Bybit, the broker ID is an HTTP header. Headers sit outside Bybit's
 * signed string, so the relay adds it server-side and the browser never needs
 * to know it. For Aster, `builder` and `feeRate` are ORDER PARAMETERS, and
 * every parameter is inside the EIP-712 signature. The relay cannot add them:
 * it would invalidate a signature it has no key to recompute.
 *
 * So the builder address is necessarily public - hence `NEXT_PUBLIC_`. That is
 * not a leak. A builder address is a public on-chain address, and the fee rate
 * is something the user explicitly approves a ceiling for via `approveBuilder`
 * before a single order can carry it. There is nothing here the user is not
 * entitled to see; on Aster they are required to consent to it.
 */

/** `0x` followed by 40 hex characters. */
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

export interface BuilderConfig {
  address: string;
  /**
   * Charged per order, as a decimal fraction - 0.0001 is one basis point.
   *
   * A string, not a number, and deliberately so: it is passed straight through
   * to the signed payload, and `String(0.00001)` is "0.00001" but
   * `String(0.0000001)` is "1e-7", which Aster rejects. Keeping it a string
   * means what is configured is exactly what is signed.
   */
  feeRate: string;
}

/** Decimal fraction, optionally fractional, never exponential. */
const FEE_RATE_PATTERN = /^0(\.\d+)?$|^\d+(\.\d+)?$/;

/**
 * Reads the builder configuration, returning null unless BOTH halves are
 * present and well-formed.
 *
 * Partial configuration is treated as absent rather than as an error, and that
 * is the important behaviour: an address with no fee rate would attribute
 * volume at a rate Aster defaults, and a fee rate with no address would be sent
 * with nothing to credit. Both look like working software while earning
 * nothing, which is the exact failure the Bybit broker header was written to
 * avoid.
 */
export function readBuilderConfig(
  address: string | null | undefined,
  feeRate: string | null | undefined
): BuilderConfig | null {
  const trimmedAddress = address?.trim();
  const trimmedFeeRate = feeRate?.trim();

  if (!trimmedAddress || !trimmedFeeRate) return null;
  if (!ADDRESS_PATTERN.test(trimmedAddress)) return null;
  if (!FEE_RATE_PATTERN.test(trimmedFeeRate)) return null;
  if (Number(trimmedFeeRate) <= 0) return null;

  return { address: trimmedAddress, feeRate: trimmedFeeRate };
}

/**
 * Attaches builder attribution to an order's parameters.
 *
 * Returns a new object; when no builder is configured the parameters come back
 * untouched, so an unconfigured deployment places ordinary unattributed orders
 * rather than failing.
 */
export function attachBuilder<T extends Record<string, unknown>>(
  params: T,
  builder: BuilderConfig | null
): T & { builder?: string; feeRate?: string } {
  if (builder === null) return { ...params };
  return { ...params, builder: builder.address, feeRate: builder.feeRate };
}

/**
 * The ceiling the user approves once, via `approveBuilder`, before any order
 * can carry a fee.
 *
 * Headroom is intentional. `maxFeeRate` is signed by the user's own wallet, so
 * raising it later means going back and asking them to sign again - an
 * interruption mid-session that looks like something has gone wrong. Approving
 * a ceiling above the current rate leaves room to adjust pricing without that,
 * while still bounding what can ever be charged.
 *
 * The multiple is small on purpose: this number is shown to the user at the
 * moment they approve it, and a ceiling wildly above the actual rate is the
 * kind of thing that makes someone close the tab.
 */
export const MAX_FEE_RATE_HEADROOM = 2;

export function approvalCeiling(builder: BuilderConfig): string {
  const ceiling = Number(builder.feeRate) * MAX_FEE_RATE_HEADROOM;
  // toFixed(8) rather than String(): the multiplication can land on a float
  // artefact like 0.000020000000000000002, and an exponential form is rejected.
  return ceiling.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
}

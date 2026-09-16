/**
 * Aster hosts and chain identifiers.
 *
 * Split into its own module because the chain IDs are genuinely confusing and
 * the confusion is Aster's, not ours - see `SIGNATURE_CHAIN_ID` below.
 */

export type AsterNetwork = "mainnet" | "testnet";

export interface AsterNetworkConfig {
  /**
   * Base host. Paths already carry the `/fapi/v3` prefix.
   *
   * Aster's own docs disagree with themselves here: the stated base endpoint
   * is `fapi.asterdex.com` (twice), while the runnable Python examples use
   * `fapi3.asterdex.com`. The stated endpoint wins - it is the normative line,
   * the example host appears nowhere else, and the V1 docs use the same host,
   * which suggests fapi3 is an author's scratch host rather than a V3 split.
   */
  host: string;
  /** EIP-712 domain chainId for AGENT-signed requests (orders, queries). */
  chainId: number;
}

export const ASTER_NETWORKS: Readonly<Record<AsterNetwork, AsterNetworkConfig>> = {
  mainnet: {
    host: "https://fapi.asterdex.com",
    chainId: 1666,
  },
  testnet: {
    host: "https://fapi.asterdex-testnet.com",
    chainId: 714,
  },
} as const;

/**
 * The EIP-712 domain chainId for MAIN-WALLET-signed requests, and the value
 * sent alongside them as `signatureChainId`.
 *
 * This is 56 (BNB Chain) on both networks, and it is deliberately NOT
 * `ASTER_NETWORKS[network].chainId`. Aster's own reference implementation signs
 * agent requests under chain 1666 (mainnet) or 714 (testnet), but signs
 * main-wallet requests - approveAgent, approveBuilder - under 56, because those
 * are authorisations made by the wallet on the chain the wallet actually lives
 * on. Using the network chainId here produces a valid-looking signature that
 * recovers to the wrong address and is rejected as unauthorised, which reads
 * like a permissions bug rather than a signing one.
 */
export const SIGNATURE_CHAIN_ID = 56;

/** The single relay host allowlist, mirroring how the Bybit relay picks its
 *  host server-side rather than trusting a caller-supplied URL. */
export const ASTER_HOSTS: readonly string[] = Object.values(ASTER_NETWORKS).map(
  (network) => network.host
);

export function asterNetwork(network: AsterNetwork): AsterNetworkConfig {
  return ASTER_NETWORKS[network];
}

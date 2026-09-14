/**
 * Micro E-mini Nasdaq-100 (MNQ) contract specification.
 *
 * Every number the dashboard shows in dollars passes through here. MNQ is
 * quoted in index points but settled in dollars at a fixed multiplier, and
 * getting that multiplier wrong is the kind of bug that does not look like a
 * bug: the chart is right, the setup is right, and the position size is 5x
 * what the account can survive.
 *
 * MNQ is deliberately the only instrument in this module. Its little sibling
 * NQ moves $20 a point rather than $2, so a "just add NQ" change that reuses
 * these constants would understate risk by an order of magnitude.
 */
export const MNQ = {
  symbol: "MNQ",
  name: "Micro E-mini Nasdaq-100",
  exchange: "CME",
  /** Minimum price increment, in index points. */
  tickSize: 0.25,
  /** Dollars per tick, per contract. */
  tickValue: 0.5,
  /** Dollars per index point, per contract. tickValue / tickSize. */
  pointValue: 2,
  /** Quarterly expiries: March, June, September, December. */
  contractMonths: [3, 6, 9, 12] as const,
  currency: "USD",
} as const;

/** Round a raw price to a tradeable price. Stops and targets that sit between
 * ticks get silently rounded by the venue, so we round here instead and show
 * the trader the price that will actually rest. */
export function roundToTick(price: number): number {
  return Math.round(price / MNQ.tickSize) * MNQ.tickSize;
}

export function pointsToTicks(points: number): number {
  return points / MNQ.tickSize;
}

export function ticksToPoints(ticks: number): number {
  return ticks * MNQ.tickSize;
}

/** Dollar value of a move of `points` index points across `contracts` lots. */
export function pointsToUsd(points: number, contracts = 1): number {
  return points * MNQ.pointValue * contracts;
}

/** Index points equivalent to a dollar amount, at a given contract count. */
export function usdToPoints(usd: number, contracts = 1): number {
  if (contracts <= 0) return 0;
  return usd / (MNQ.pointValue * contracts);
}

/**
 * Largest whole contract count whose loss at the stop stays within `riskUsd`.
 *
 * Floors rather than rounds, on purpose. Rounding up a 1.6-contract answer to
 * 2 overshoots the risk budget by 25% on every single trade, which is exactly
 * how an account that "never risked more than 1%" ends up breaching.
 */
export function contractsForRisk(riskUsd: number, stopPoints: number): number {
  if (stopPoints <= 0 || riskUsd <= 0) return 0;
  return Math.floor(riskUsd / pointsToUsd(stopPoints));
}

/** Format an MNQ price the way the exchange quotes it: two decimals, always. */
export function formatMnqPrice(price: number): string {
  return price.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format an index-point distance, e.g. a stop width. */
export function formatPoints(points: number): string {
  return `${points >= 0 ? "" : "-"}${Math.abs(points).toFixed(2)} pt`;
}

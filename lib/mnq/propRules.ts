import { MNQ, contractsForRisk, pointsToUsd } from "@/lib/mnq/contract";
import { minutesUntilFlatten } from "@/lib/mnq/sessions";

/**
 * Prop-firm rule engine.
 *
 * A funded evaluation is a survival problem, not a profitability problem. The
 * account is killed by a path, not by an average: a strategy with excellent
 * expectancy and lumpy equity fails an intraday trailing drawdown that a
 * worse, smoother strategy walks through. So every setup the scanner produces
 * is gated here before it is shown as tradeable, and the dashboard renders the
 * distance to the floor as prominently as it renders price.
 *
 * The presets below are TEMPLATES, not quoted terms. Firms change limits,
 * trailing modes and consistency rules frequently and without notice, and the
 * difference between trailing on unrealized and trailing on closed balance is
 * the difference between passing and breaching. Open the account dashboard,
 * read the current numbers, and set them here before trusting any output.
 */

export type DrawdownMode =
  /** Floor follows peak equity INCLUDING open profit. The harshest, and the
   * most common at futures prop firms. A trade that runs +$800 and is closed
   * at +$100 still raises the floor by $800. */
  | "trailing-intraday"
  /** Floor follows the highest end-of-day closed balance. Open profit during
   * the day does not move it. */
  | "trailing-eod"
  /** Floor is fixed at starting balance minus the allowance. */
  | "static";

export interface PropRules {
  id: string;
  label: string;
  accountSize: number;
  /** Profit needed to pass. Null for a funded account with no target. */
  profitTarget: number | null;
  drawdown: {
    /** Dollar allowance below the peak. */
    amount: number;
    mode: DrawdownMode;
    /**
     * Profit level at which the floor stops trailing and locks, usually at or
     * just above the starting balance. Null means it trails forever.
     */
    lockAtProfit: number | null;
  };
  /** Max loss in a single trading day. Null when the firm has no daily limit. */
  dailyLossLimit: number | null;
  /**
   * Consistency rule: the largest share of total profit any one day may
   * contribute, as a fraction. 0.3 means no day may be more than 30% of
   * cumulative profit at payout time. Null when not enforced.
   */
  consistencyPct: number | null;
  maxContracts: number;
  /** ET minutes-of-day by which all positions must be flat. */
  flattenAtMinute: number;
  minTradingDays: number;
}

/** Fraction of the remaining drawdown room risked on any one trade. */
export const DEFAULT_RISK_FRACTION = 0.02;

const H = (hour: number, minute = 0) => hour * 60 + minute;

/**
 * Starting templates keyed by trailing style rather than by firm name, because
 * the style is what changes the maths and the firm names change what they
 * offer. Numbers are typical of a 50K evaluation; verify and edit.
 */
export const RULE_PRESETS: PropRules[] = [
  {
    id: "trailing-intraday-50k",
    label: "50K · intraday trailing",
    accountSize: 50_000,
    profitTarget: 3_000,
    drawdown: { amount: 2_000, mode: "trailing-intraday", lockAtProfit: 2_000 },
    dailyLossLimit: null,
    consistencyPct: 0.3,
    maxContracts: 10,
    flattenAtMinute: H(16, 59),
    minTradingDays: 7,
  },
  {
    id: "trailing-eod-50k",
    label: "50K · end-of-day trailing",
    accountSize: 50_000,
    profitTarget: 3_000,
    drawdown: { amount: 2_000, mode: "trailing-eod", lockAtProfit: null },
    dailyLossLimit: 1_100,
    consistencyPct: 0.4,
    maxContracts: 10,
    flattenAtMinute: H(15, 55),
    minTradingDays: 5,
  },
  {
    id: "static-50k",
    label: "50K · static drawdown",
    accountSize: 50_000,
    profitTarget: 3_000,
    drawdown: { amount: 2_500, mode: "static", lockAtProfit: null },
    dailyLossLimit: 1_250,
    consistencyPct: null,
    maxContracts: 10,
    flattenAtMinute: H(16, 10),
    minTradingDays: 3,
  },
];

export interface AccountState {
  /** Realized, closed balance. */
  balance: number;
  /** Mark-to-market P&L of anything currently open. */
  openPnl: number;
  /** Highest equity (balance + openPnl) ever reached on this account. */
  peakEquity: number;
  /** Highest end-of-day closed balance ever reached. */
  peakEodBalance: number;
  /** Closed balance at the start of the current ET trading day. */
  dayStartBalance: number;
  /** Realized P&L per ET date key, for the consistency rule. */
  dailyPnl: Record<string, number>;
  /** Distinct days with at least one closed trade. */
  tradingDays: number;
}

export function emptyAccount(rules: PropRules): AccountState {
  return {
    balance: rules.accountSize,
    openPnl: 0,
    peakEquity: rules.accountSize,
    peakEodBalance: rules.accountSize,
    dayStartBalance: rules.accountSize,
    dailyPnl: {},
    tradingDays: 0,
  };
}

/**
 * The equity level at which the account is dead.
 *
 * This is the number that should be on the screen at all times. Under
 * intraday trailing it moves up with unrealized profit and never moves back
 * down, which is why a trader who "gave back an open winner" can find
 * themselves closer to breaching than before the trade.
 */
export function drawdownFloor(account: AccountState, rules: PropRules): number {
  const { amount, mode, lockAtProfit } = rules.drawdown;

  if (mode === "static") return rules.accountSize - amount;

  const peak = mode === "trailing-intraday" ? account.peakEquity : account.peakEodBalance;
  const trailed = peak - amount;

  // Once the floor reaches the lock level it stops following the peak.
  if (lockAtProfit !== null) {
    const locked = rules.accountSize + lockAtProfit - amount;
    return Math.min(trailed, Math.max(locked, rules.accountSize));
  }
  return trailed;
}

export interface AccountAssessment {
  equity: number;
  floor: number;
  /** Dollars between current equity and the floor. Zero means breached. */
  roomUsd: number;
  /** Same distance expressed as MNQ points on one contract. */
  roomPoints: number;
  /** Fraction of the total drawdown allowance still available, 0..1. */
  roomFraction: number;
  /** Dollars left before the daily loss limit, or null when there is none. */
  dailyRoomUsd: number | null;
  /** Profit still needed to pass, or null when there is no target. */
  toTargetUsd: number | null;
  breached: boolean;
  /** Human-readable problems, worst first. Empty when the account is healthy. */
  warnings: string[];
}

export function assessAccount(account: AccountState, rules: PropRules): AccountAssessment {
  const equity = account.balance + account.openPnl;
  const floor = drawdownFloor(account, rules);
  const roomUsd = Math.max(0, equity - floor);
  const totalAllowance = rules.drawdown.amount;

  const dayPnl = account.balance - account.dayStartBalance + account.openPnl;
  const dailyRoomUsd =
    rules.dailyLossLimit === null ? null : Math.max(0, rules.dailyLossLimit + Math.min(0, dayPnl));

  const profit = account.balance - rules.accountSize;
  const toTargetUsd = rules.profitTarget === null ? null : Math.max(0, rules.profitTarget - profit);

  const warnings: string[] = [];
  const breached = equity <= floor;
  if (breached) warnings.push("Drawdown floor breached — account is dead.");
  if (dailyRoomUsd !== null && dailyRoomUsd <= 0) warnings.push("Daily loss limit hit — no more trades today.");
  // Inclusive: landing exactly on a quarter of the allowance is still the
  // point at which the trader needs telling, not one dollar below it.
  if (!breached && roomUsd <= totalAllowance * 0.25) {
    warnings.push(`Only $${roomUsd.toFixed(0)} of $${totalAllowance.toFixed(0)} drawdown left.`);
  }
  if (account.tradingDays < rules.minTradingDays) {
    warnings.push(`${rules.minTradingDays - account.tradingDays} more trading day(s) required.`);
  }

  const consistency = assessConsistency(account, rules);
  if (consistency) warnings.push(consistency);

  return {
    equity,
    floor,
    roomUsd,
    roomPoints: roomUsd / MNQ.pointValue,
    roomFraction: totalAllowance > 0 ? Math.min(1, roomUsd / totalAllowance) : 0,
    dailyRoomUsd,
    toTargetUsd,
    breached,
    warnings,
  };
}

/**
 * Consistency rule check.
 *
 * Returns a warning when the best day already exceeds its permitted share of
 * cumulative profit. This is worth surfacing early: it is not a breach, but it
 * caps the payout until enough smaller winning days dilute it, and traders
 * routinely discover it only after hitting the target.
 */
function assessConsistency(account: AccountState, rules: PropRules): string | null {
  if (rules.consistencyPct === null) return null;

  const days = Object.values(account.dailyPnl);
  const totalProfit = days.reduce((sum, pnl) => sum + pnl, 0);
  if (totalProfit <= 0 || days.length === 0) return null;

  const bestDay = Math.max(...days);
  const share = bestDay / totalProfit;
  if (share <= rules.consistencyPct) return null;

  // Profit needed elsewhere to bring the best day back within its share.
  const requiredTotal = bestDay / rules.consistencyPct;
  const shortfall = requiredTotal - totalProfit;
  return `Consistency: best day is ${(share * 100).toFixed(0)}% of profit (limit ${(rules.consistencyPct * 100).toFixed(0)}%). Needs ~$${shortfall.toFixed(0)} more from other days.`;
}

/**
 * Dollars allowed to be risked on the next trade.
 *
 * Deliberately sized off the REMAINING room rather than the account size, so
 * risk shrinks automatically as the account approaches its floor instead of
 * staying flat and taking the account out in a fixed number of losers.
 */
export function riskBudgetUsd(
  assessment: AccountAssessment,
  rules: PropRules,
  riskFraction = DEFAULT_RISK_FRACTION,
): number {
  if (assessment.breached) return 0;

  const fromDrawdown = assessment.roomUsd * riskFraction;
  const budget =
    assessment.dailyRoomUsd === null ? fromDrawdown : Math.min(fromDrawdown, assessment.dailyRoomUsd);

  // Never let a single trade be able to reach the floor on its own.
  return Math.max(0, Math.min(budget, assessment.roomUsd * 0.5));
}

export interface SetupGate {
  allowed: boolean;
  /** Contracts the rules permit. Zero whenever `allowed` is false. */
  contracts: number;
  riskUsd: number;
  /** Why it was blocked, or notes when allowed. */
  reasons: string[];
}

/**
 * Decide whether a setup may be taken, and at what size.
 *
 * Every block reason is returned rather than short-circuiting on the first,
 * because "you are near the floor AND it is 16:52" is more useful to a trader
 * than either half alone.
 */
export function gateSetup(
  params: { stopPoints: number; targetPoints: number; timestampMs: number },
  account: AccountState,
  rules: PropRules,
  riskFraction = DEFAULT_RISK_FRACTION,
): SetupGate {
  const assessment = assessAccount(account, rules);
  const reasons: string[] = [];

  if (assessment.breached) reasons.push("Account has breached its drawdown floor.");
  if (assessment.dailyRoomUsd !== null && assessment.dailyRoomUsd <= 0) {
    reasons.push("Daily loss limit reached.");
  }

  const minutesLeft = minutesUntilFlatten(params.timestampMs, rules.flattenAtMinute);
  if (minutesLeft <= 0) {
    reasons.push("Past the flatten deadline.");
  } else if (minutesLeft < 15) {
    reasons.push(`Only ${minutesLeft} min to forced flatten.`);
  }

  if (params.stopPoints <= 0) reasons.push("Setup has no valid stop.");

  const riskUsd = riskBudgetUsd(assessment, rules, riskFraction);
  let contracts = contractsForRisk(riskUsd, params.stopPoints);

  if (contracts > rules.maxContracts) {
    contracts = rules.maxContracts;
    reasons.push(`Capped at ${rules.maxContracts} contracts by account tier.`);
  }

  if (contracts < 1) {
    reasons.push(
      `Stop of ${params.stopPoints.toFixed(2)} pt costs $${pointsToUsd(params.stopPoints).toFixed(2)} on one contract — more than the $${riskUsd.toFixed(2)} budget.`,
    );
  }

  // A blocking reason is anything other than the informational size cap.
  const blocking = reasons.filter((r) => !r.startsWith("Capped at"));
  const allowed = blocking.length === 0 && contracts >= 1 && minutesLeft > 0;

  return { allowed, contracts: allowed ? contracts : 0, riskUsd, reasons };
}

/**
 * Apply a closed trade to the account.
 *
 * Peak equity is updated on the way through because under intraday trailing
 * the peak the trade reached matters even though it was given back.
 */
export function applyTrade(
  account: AccountState,
  params: { pnlUsd: number; peakOpenPnlUsd: number; dateKey: string },
): AccountState {
  const peakEquity = Math.max(account.peakEquity, account.balance + params.peakOpenPnlUsd);
  const balance = account.balance + params.pnlUsd;
  const alreadyTradedToday = account.dailyPnl[params.dateKey] !== undefined;

  return {
    ...account,
    balance,
    openPnl: 0,
    peakEquity: Math.max(peakEquity, balance),
    dailyPnl: { ...account.dailyPnl, [params.dateKey]: (account.dailyPnl[params.dateKey] ?? 0) + params.pnlUsd },
    tradingDays: alreadyTradedToday ? account.tradingDays : account.tradingDays + 1,
  };
}

/** Roll the account into a new ET trading day. */
export function rollDay(account: AccountState): AccountState {
  return {
    ...account,
    dayStartBalance: account.balance,
    peakEodBalance: Math.max(account.peakEodBalance, account.balance),
  };
}

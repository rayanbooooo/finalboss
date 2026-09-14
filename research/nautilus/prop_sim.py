#!/usr/bin/env python3
"""
Monte Carlo simulator for prop-firm evaluations.

The question a futures prop trader actually needs answered is not "is this
strategy profitable" but "what fraction of evaluation attempts does it
survive". Those are different questions with different answers, because an
evaluation is killed by a path, not by an average. A strategy with strong
expectancy and lumpy equity fails an intraday trailing drawdown that a worse,
smoother strategy walks straight through.

This models the path. Zero dependencies — stdlib only — so it runs anywhere,
including in CI.

Why max-favourable-excursion is a first-class input
---------------------------------------------------
Under intraday trailing drawdown the floor follows peak equity INCLUDING open
profit, and never retreats. So a trade that runs +3R and is closed at +0.2R
still raises the kill line by 3R worth of dollars. Any simulator that only
looks at closed P&L will systematically overstate survival, because it never
sees the give-back. `mfe_r` is how far a losing trade typically travels in your
favour before reversing, and it is the difference between a model that is
roughly right and one that is comfortingly wrong.

Usage
-----
    python3 prop_sim.py                          # built-in example
    python3 prop_sim.py --win-rate 0.4 --rr 2    # explicit distribution
    python3 prop_sim.py --trades-json r.json     # realised R from the scanner
"""

from __future__ import annotations

import argparse
import json
import random
import statistics
from dataclasses import dataclass, field
from typing import List, Optional, Sequence


@dataclass
class Rules:
    """Prop-firm rules. Mirrors lib/mnq/propRules.ts — keep the two in step."""

    account_size: float = 50_000.0
    profit_target: float = 3_000.0
    drawdown_amount: float = 2_000.0
    # "trailing-intraday" | "trailing-eod" | "static"
    drawdown_mode: str = "trailing-intraday"
    # Profit at which the floor stops trailing; None trails forever.
    lock_at_profit: Optional[float] = 2_000.0
    daily_loss_limit: Optional[float] = None
    consistency_pct: Optional[float] = 0.30
    min_trading_days: int = 7
    max_days: int = 60


@dataclass
class TradeModel:
    """How a single trade behaves, in R multiples."""

    win_rate: float = 0.40
    reward_r: float = 2.0
    # Dollars risked per trade.
    risk_usd: float = 250.0
    trades_per_day: int = 3
    # How far a LOSING trade typically runs in your favour before reversing,
    # as a fraction of the reward target. Only bites under intraday trailing.
    mfe_r: float = 0.55
    # Explicit realised-R samples. When present, win_rate/reward_r are ignored
    # and outcomes are drawn from this empirical distribution instead.
    samples: Optional[Sequence[float]] = None


@dataclass
class Outcome:
    passed: bool
    breached: bool
    ran_out_of_time: bool
    days_used: int
    final_balance: float
    consistency_blocked: bool


@dataclass
class Summary:
    runs: int
    p_pass: float
    p_breach: float
    p_timeout: float
    p_consistency_blocked: float
    median_days_to_pass: Optional[float]
    mean_final_balance: float
    worst_final_balance: float
    daily_pnls: List[float] = field(default_factory=list)


def _draw_trade(model: TradeModel, rng: random.Random) -> tuple[float, float]:
    """Return (realised R, peak favourable R) for one trade."""
    if model.samples:
        realised = rng.choice(list(model.samples))
        # A winner's peak is at least its close. A loser still travelled some
        # distance in your favour first.
        peak = realised if realised > 0 else model.mfe_r * model.reward_r * rng.random()
        return realised, max(peak, 0.0)

    if rng.random() < model.win_rate:
        return model.reward_r, model.reward_r

    # Losers: -1R closed, but they wandered up first.
    return -1.0, model.mfe_r * model.reward_r * rng.random()


def simulate_once(rules: Rules, model: TradeModel, rng: random.Random) -> Outcome:
    balance = rules.account_size
    peak_equity = balance
    peak_eod = balance
    daily_pnl: List[float] = []

    for day in range(1, rules.max_days + 1):
        day_start = balance
        day_pnl = 0.0

        for _ in range(model.trades_per_day):
            realised_r, peak_r = _draw_trade(model, rng)

            # The open-profit excursion moves the intraday peak even if the
            # trade closes for less. This is the give-back that kills accounts.
            peak_equity = max(peak_equity, balance + peak_r * model.risk_usd)

            balance += realised_r * model.risk_usd
            day_pnl += realised_r * model.risk_usd
            peak_equity = max(peak_equity, balance)

            floor = _floor(rules, peak_equity, peak_eod)
            if balance <= floor:
                daily_pnl.append(day_pnl)
                return Outcome(False, True, False, day, balance, False)

            if rules.daily_loss_limit is not None and day_pnl <= -rules.daily_loss_limit:
                break  # Done for the day, not dead.

        daily_pnl.append(day_pnl)
        peak_eod = max(peak_eod, balance)
        _ = day_start

        profit = balance - rules.account_size
        if profit >= rules.profit_target and day >= rules.min_trading_days:
            blocked = _consistency_blocked(rules, daily_pnl)
            # A consistency breach does not end the evaluation; it withholds the
            # payout until other days dilute the best one. Treated here as "not
            # passed yet", which is what it means in practice.
            if not blocked:
                return Outcome(True, False, False, day, balance, False)

    return Outcome(
        False,
        False,
        True,
        rules.max_days,
        balance,
        _consistency_blocked(rules, daily_pnl),
    )


def _floor(rules: Rules, peak_equity: float, peak_eod: float) -> float:
    if rules.drawdown_mode == "static":
        return rules.account_size - rules.drawdown_amount

    peak = peak_equity if rules.drawdown_mode == "trailing-intraday" else peak_eod
    trailed = peak - rules.drawdown_amount

    if rules.lock_at_profit is not None:
        locked = rules.account_size + rules.lock_at_profit - rules.drawdown_amount
        return min(trailed, max(locked, rules.account_size))
    return trailed


def _consistency_blocked(rules: Rules, daily_pnl: Sequence[float]) -> bool:
    if rules.consistency_pct is None:
        return False
    total = sum(p for p in daily_pnl if p > 0)
    if total <= 0:
        return False
    best = max(daily_pnl)
    return best / total > rules.consistency_pct


def simulate(rules: Rules, model: TradeModel, runs: int = 10_000, seed: int = 7) -> Summary:
    rng = random.Random(seed)
    outcomes = [simulate_once(rules, model, rng) for _ in range(runs)]

    passes = [o for o in outcomes if o.passed]
    return Summary(
        runs=runs,
        p_pass=len(passes) / runs,
        p_breach=sum(o.breached for o in outcomes) / runs,
        p_timeout=sum(o.ran_out_of_time for o in outcomes) / runs,
        p_consistency_blocked=sum(o.consistency_blocked for o in outcomes) / runs,
        median_days_to_pass=statistics.median([o.days_used for o in passes]) if passes else None,
        mean_final_balance=statistics.fmean(o.final_balance for o in outcomes),
        worst_final_balance=min(o.final_balance for o in outcomes),
    )


def _report(label: str, summary: Summary) -> None:
    print(f"\n{label}")
    print(f"  P(pass)              {summary.p_pass:6.1%}")
    print(f"  P(breach)            {summary.p_breach:6.1%}")
    print(f"  P(ran out of time)   {summary.p_timeout:6.1%}")
    print(f"  P(consistency block) {summary.p_consistency_blocked:6.1%}")
    days = summary.median_days_to_pass
    print(f"  Median days to pass  {days if days is not None else '—'}")
    print(f"  Mean final balance   ${summary.mean_final_balance:,.0f}")
    print(f"  Worst final balance  ${summary.worst_final_balance:,.0f}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Prop-firm evaluation Monte Carlo")
    parser.add_argument("--win-rate", type=float, default=0.40)
    parser.add_argument("--rr", type=float, default=2.0, help="Reward in R per winner")
    parser.add_argument("--risk", type=float, default=250.0, help="Dollars risked per trade")
    parser.add_argument("--trades-per-day", type=int, default=3)
    parser.add_argument("--mfe-r", type=float, default=0.55,
                        help="How far a loser runs in your favour first, as a fraction of target")
    parser.add_argument("--runs", type=int, default=10_000)
    parser.add_argument("--account", type=float, default=50_000.0)
    parser.add_argument("--target", type=float, default=3_000.0)
    parser.add_argument("--drawdown", type=float, default=2_000.0)
    parser.add_argument("--trades-json", type=str, default=None,
                        help="JSON array of realised R values exported from the scanner")
    parser.add_argument("--lock-at-profit", type=float, default=None,
                        help="Profit at which the floor stops trailing. Omit to trail forever.")
    args = parser.parse_args()

    samples = None
    if args.trades_json:
        with open(args.trades_json) as handle:
            samples = [float(v) for v in json.load(handle)]
        print(f"Loaded {len(samples)} realised-R samples from {args.trades_json}")

    model = TradeModel(
        win_rate=args.win_rate,
        reward_r=args.rr,
        risk_usd=args.risk,
        trades_per_day=args.trades_per_day,
        mfe_r=args.mfe_r,
        samples=samples,
    )

    base = Rules(account_size=args.account, profit_target=args.target, drawdown_amount=args.drawdown)

    print("=" * 64)
    if samples:
        # win_rate and rr are ignored when samples are supplied, so printing
        # them here would describe a model that is not the one being run.
        wins = [r for r in samples if r > 0]
        empirical_win_rate = len(wins) / len(samples)
        expectancy = sum(samples) / len(samples)
        print(f"Trade model: empirical, {len(samples)} realised-R samples")
        print(f"  win rate {empirical_win_rate:.1%} | mean winner "
              f"{(sum(wins) / len(wins)) if wins else 0:+.2f}R | ${args.risk:.0f} risk, "
              f"{args.trades_per_day}/day")
        print(f"Expectancy: {expectancy:+.3f}R per trade (measured)")
    else:
        print(f"Trade model: {args.win_rate:.0%} win rate, {args.rr}R target, ${args.risk:.0f} risk, "
              f"{args.trades_per_day}/day, MFE {args.mfe_r:.0%}")
        print(f"Expectancy: {args.win_rate * args.rr - (1 - args.win_rate):+.3f}R per trade")
    print("=" * 64)

    # The same strategy against each drawdown style.
    #
    # lock_at_profit is held CONSTANT across the three, because it is a second
    # variable and a strong one: an early-locking floor caps at the starting
    # balance, the ratchet never engages, and all three modes then look
    # identical — which is a statement about the lock, not about trailing.
    for mode in ("trailing-intraday", "trailing-eod", "static"):
        rules = Rules(
            account_size=base.account_size,
            profit_target=base.profit_target,
            drawdown_amount=base.drawdown_amount,
            drawdown_mode=mode,
            lock_at_profit=args.lock_at_profit,
        )
        _report(mode, simulate(rules, model, runs=args.runs))

    # And the cost of the give-back, holding everything else equal.
    print("\n" + "=" * 64)
    print("Sensitivity to give-back (intraday trailing, floor never locks)")
    print("=" * 64)
    for mfe in (0.0, 0.25, 0.5, 0.75, 1.0):
        variant = TradeModel(
            win_rate=model.win_rate, reward_r=model.reward_r, risk_usd=model.risk_usd,
            trades_per_day=model.trades_per_day, mfe_r=mfe, samples=model.samples,
        )
        summary = simulate(
            Rules(
                account_size=base.account_size,
                profit_target=base.profit_target,
                drawdown_amount=base.drawdown_amount,
                drawdown_mode="trailing-intraday",
                lock_at_profit=None,
            ),
            variant,
            runs=args.runs,
        )
        print(f"  MFE {mfe:4.0%} of target -> P(pass) {summary.p_pass:6.1%}   P(breach) {summary.p_breach:6.1%}")


if __name__ == "__main__":
    main()

"""
Self-tests for the prop evaluation simulator. Stdlib unittest, no pytest.

    python3 test_prop_sim.py
"""

import unittest

from prop_sim import Rules, TradeModel, simulate, simulate_once, _consistency_blocked, _floor
import random


class TestFloor(unittest.TestCase):
    def test_static_floor_never_moves(self):
        rules = Rules(drawdown_mode="static", drawdown_amount=2_000)
        self.assertEqual(_floor(rules, 99_000, 99_000), 48_000)

    def test_intraday_floor_follows_peak(self):
        rules = Rules(drawdown_mode="trailing-intraday", drawdown_amount=2_000, lock_at_profit=None)
        self.assertEqual(_floor(rules, 50_000, 50_000), 48_000)
        # Peak rose by 800 on unrealised profit; the floor followed it.
        self.assertEqual(_floor(rules, 50_800, 50_000), 48_800)

    def test_eod_floor_ignores_intraday_peak(self):
        rules = Rules(drawdown_mode="trailing-eod", drawdown_amount=2_000, lock_at_profit=None)
        self.assertEqual(_floor(rules, 50_800, 50_000), 48_000)

    def test_lock_caps_the_floor(self):
        rules = Rules(drawdown_mode="trailing-intraday", drawdown_amount=2_000, lock_at_profit=2_000)
        # Locks at 50_000 + 2_000 - 2_000 and never climbs past it.
        self.assertEqual(_floor(rules, 80_000, 80_000), 50_000)


class TestConsistency(unittest.TestCase):
    def test_flags_a_dominant_day(self):
        rules = Rules(consistency_pct=0.30)
        self.assertTrue(_consistency_blocked(rules, [900.0, 100.0]))

    def test_passes_when_spread_out(self):
        rules = Rules(consistency_pct=0.30)
        self.assertFalse(_consistency_blocked(rules, [250.0, 250.0, 250.0, 250.0]))

    def test_disabled_when_none(self):
        self.assertFalse(_consistency_blocked(Rules(consistency_pct=None), [900.0, 100.0]))


class TestSimulation(unittest.TestCase):
    def test_deterministic_for_a_seed(self):
        rules, model = Rules(), TradeModel()
        a = simulate(rules, model, runs=400, seed=11)
        b = simulate(rules, model, runs=400, seed=11)
        self.assertEqual(a.p_pass, b.p_pass)
        self.assertEqual(a.p_breach, b.p_breach)

    def test_probabilities_sum_to_one(self):
        s = simulate(Rules(), TradeModel(), runs=800, seed=3)
        self.assertAlmostEqual(s.p_pass + s.p_breach + s.p_timeout, 1.0, places=6)

    def test_a_losing_strategy_essentially_never_passes(self):
        # 10% win rate at 2R is -0.7R per trade.
        model = TradeModel(win_rate=0.10, reward_r=2.0)
        s = simulate(Rules(), model, runs=800, seed=5)
        self.assertLess(s.p_pass, 0.02)
        self.assertGreater(s.p_breach, 0.9)

    def test_static_drawdown_is_more_survivable_than_intraday_trailing(self):
        """The headline claim, asserted so it cannot silently stop being true."""
        model = TradeModel(win_rate=0.40, reward_r=2.0, mfe_r=0.8)
        intraday = simulate(
            Rules(drawdown_mode="trailing-intraday", lock_at_profit=None), model, runs=2_000, seed=9
        )
        static = simulate(
            Rules(drawdown_mode="static", lock_at_profit=None), model, runs=2_000, seed=9
        )
        self.assertGreater(static.p_pass, intraday.p_pass)

    def test_never_finishes_below_the_floor(self):
        rules = Rules(drawdown_mode="static", drawdown_amount=2_000, lock_at_profit=None)
        rng = random.Random(4)
        for _ in range(300):
            outcome = simulate_once(rules, TradeModel(), rng)
            if outcome.breached:
                # A breach stops immediately; it cannot keep trading below the line.
                self.assertLessEqual(outcome.final_balance, rules.account_size - rules.drawdown_amount + 1e-9)

    def test_empirical_samples_are_used(self):
        """With every sample a winner, the evaluation must pass."""
        model = TradeModel(samples=[2.0] * 10, risk_usd=250.0, trades_per_day=3)
        s = simulate(Rules(min_trading_days=1), model, runs=200, seed=2)
        self.assertEqual(s.p_pass, 1.0)


if __name__ == "__main__":
    unittest.main(verbosity=2)

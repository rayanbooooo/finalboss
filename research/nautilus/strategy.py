"""
NautilusTrader v2 strategy that executes MNQ setups from the TypeScript scanner.

Why the signals come from JSON rather than from Python
------------------------------------------------------
The setup logic lives once, in lib/mnq/*.ts, and is what the dashboard shows
and what a trader would act on. Re-implementing it here would give two
implementations that agree until the first change to either, and a backtest of
code you do not trade is worse than no backtest at all.

So the pipeline is: the TS engine emits setups (GET /api/mnq/scan), and this
strategy executes them through Nautilus's matching engine. That is what
Nautilus contributes over the TS resolver in setups.ts — real fills, slippage,
commissions and margin, instead of "did a later bar touch this price".

Written against NautilusTrader v2.0.0rc5 (the Rust + PyO3 package). v1 import
paths do NOT work; see MIGRATION_V2.md upstream.

NOT RUN in this environment — nautilus_trader is not installed here and the
package is a release candidate the maintainers do not recommend for production
live trading. Treat it as reviewed code that still needs a first run.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from nautilus_trader.common import LogColor
from nautilus_trader.model import Bar, BarType, InstrumentId, OrderSide, Quantity
from nautilus_trader.trading import Strategy, StrategyConfig

# MNQ contract spec, mirroring lib/mnq/contract.ts.
MNQ_POINT_VALUE = 2.0
MNQ_TICK_SIZE = 0.25


class MnqSetupConfig(StrategyConfig, frozen=True):
    """Configuration for the setup-replay strategy."""

    instrument_id: InstrumentId
    bar_type: BarType
    # JSON produced by GET /api/mnq/scan.
    setups_path: str
    account_size: float = 50_000.0
    drawdown_amount: float = 2_000.0
    # "trailing-intraday" | "trailing-eod" | "static"
    drawdown_mode: str = "trailing-intraday"
    lock_at_profit: Optional[float] = 2_000.0
    max_contracts: int = 10
    risk_fraction: float = 0.02


class MnqSetupStrategy(Strategy):
    """
    Arms each setup at its bar, enters when price trades through the entry, and
    exits at stop or target.

    Exits are managed bar by bar with market orders rather than with a resting
    bracket. That is deliberate: it uses only the v2 APIs verified against the
    upstream examples, and it keeps the fill logic explicit and auditable
    instead of depending on bracket semantics that differ between versions.
    """

    def __init__(self, config: MnqSetupConfig) -> None:
        super().__init__(config)

        self._setups: list[dict] = []
        self._armed: list[dict] = []
        self._active: Optional[dict] = None

        self._balance = config.account_size
        self._peak_equity = config.account_size
        self._breached = False

    # -- lifecycle ---------------------------------------------------------

    def on_start(self) -> None:
        payload = json.loads(Path(self.config.setups_path).read_text())
        # Chronological, so setups arm in the order the scanner found them.
        self._setups = sorted(payload["setups"], key=lambda s: s["time"])
        self.log.info(
            f"Loaded {len(self._setups)} setups from {self.config.setups_path} "
            f"(source={payload.get('source')}, live={payload.get('isLive')})",
            LogColor.BLUE,
        )
        self.subscribe_bars(self.config.bar_type)

    def on_stop(self) -> None:
        self.log.info(
            f"Final modelled balance ${self._balance:,.2f} | "
            f"peak ${self._peak_equity:,.2f} | floor ${self._drawdown_floor():,.2f} | "
            f"breached={self._breached}",
            LogColor.BLUE,
        )

    # -- bar handling ------------------------------------------------------

    def on_bar(self, bar: Bar) -> None:
        if self._breached:
            return

        bar_time_ms = bar.ts_event // 1_000_000

        # Arm any setup whose bar has now closed.
        while self._setups and self._setups[0]["time"] <= bar_time_ms:
            self._armed.append(self._setups.pop(0))

        if self._active is not None:
            self._manage_open(bar)
            return

        self._try_enter(bar)

    def _try_enter(self, bar: Bar) -> None:
        high = float(bar.high)
        low = float(bar.low)

        for setup in list(self._armed):
            entry = setup["entry"]
            is_long = setup["direction"] == "bullish"
            touched = low <= entry if is_long else high >= entry
            if not touched:
                continue

            contracts = self._size(setup["stopPoints"])
            self._armed.remove(setup)
            if contracts < 1:
                self.log.info(
                    f"Skipped {setup['id']}: rules permit 0 contracts at a "
                    f"{setup['stopPoints']:.2f}pt stop",
                )
                continue

            order = self.order_factory.market(
                instrument_id=self.config.instrument_id,
                order_side=OrderSide.BUY if is_long else OrderSide.SELL,
                quantity=Quantity.from_int(contracts),
            )
            self.submit_order(order)

            self._active = {**setup, "contracts": contracts, "peak_open_usd": 0.0}
            self.log.info(
                f"Entered {setup['direction']} {setup['pattern']} x{contracts} @ {entry} "
                f"(stop {setup['stop']}, target {setup['target']}, {setup['rr']:.2f}R)",
                LogColor.GREEN,
            )
            return

    def _manage_open(self, bar: Bar) -> None:
        setup = self._active
        assert setup is not None

        is_long = setup["direction"] == "bullish"
        high = float(bar.high)
        low = float(bar.low)
        contracts = setup["contracts"]

        # Track peak open profit — it moves the intraday trailing floor even if
        # the trade is later closed for less. Ignoring it is the single most
        # common way a prop backtest overstates survival.
        best = high if is_long else low
        open_usd = (best - setup["entry"]) * (1 if is_long else -1) * MNQ_POINT_VALUE * contracts
        setup["peak_open_usd"] = max(setup["peak_open_usd"], open_usd)
        self._peak_equity = max(self._peak_equity, self._balance + setup["peak_open_usd"])

        hit_stop = low <= setup["stop"] if is_long else high >= setup["stop"]
        hit_target = high >= setup["target"] if is_long else low <= setup["target"]

        # Pessimistic: a bar touching both resolves as the loss. From bar data
        # there is no way to know which came first, and assuming the good one is
        # how backtests lie.
        if hit_stop:
            self._close(setup["stop"], "STOP")
        elif hit_target:
            self._close(setup["target"], "TARGET")

    def _close(self, price: float, reason: str) -> None:
        setup = self._active
        assert setup is not None

        is_long = setup["direction"] == "bullish"
        contracts = setup["contracts"]

        order = self.order_factory.market(
            instrument_id=self.config.instrument_id,
            order_side=OrderSide.SELL if is_long else OrderSide.BUY,
            quantity=Quantity.from_int(contracts),
        )
        self.submit_order(order)

        pnl = (price - setup["entry"]) * (1 if is_long else -1) * MNQ_POINT_VALUE * contracts
        self._balance += pnl
        self._peak_equity = max(self._peak_equity, self._balance)
        self._active = None

        floor = self._drawdown_floor()
        if self._balance <= floor:
            self._breached = True
            self.log.error(
                f"DRAWDOWN BREACH: balance ${self._balance:,.2f} <= floor ${floor:,.2f}. "
                f"Evaluation over.",
            )
            return

        self.log.info(
            f"{reason} {pnl:+,.2f} | balance ${self._balance:,.2f} | "
            f"room to floor ${self._balance - floor:,.2f}",
            LogColor.GREEN if pnl > 0 else LogColor.RED,
        )

    # -- prop rules --------------------------------------------------------

    def _drawdown_floor(self) -> float:
        config = self.config
        if config.drawdown_mode == "static":
            return config.account_size - config.drawdown_amount

        trailed = self._peak_equity - config.drawdown_amount
        if config.lock_at_profit is not None:
            locked = config.account_size + config.lock_at_profit - config.drawdown_amount
            return min(trailed, max(locked, config.account_size))
        return trailed

    def _size(self, stop_points: float) -> int:
        """Contracts sized off REMAINING room, not account size, so risk
        contracts automatically as the floor approaches."""
        room = max(0.0, self._balance - self._drawdown_floor())
        budget = min(room * self.config.risk_fraction, room * 0.5)
        per_contract = stop_points * MNQ_POINT_VALUE
        if per_contract <= 0:
            return 0
        # Floor, never round: rounding up overshoots the risk budget on every trade.
        return min(int(budget // per_contract), self.config.max_contracts)

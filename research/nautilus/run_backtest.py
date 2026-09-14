"""
Run the MNQ setup strategy over real CME bars in a NautilusTrader v2 backtest.

Prerequisites
-------------
1. NautilusTrader v2 in its own virtualenv (v1 and v2 both import as
   `nautilus_trader`; never install both into one):

       uv venv --python 3.14 && source .venv/bin/activate
       uv pip install --pre nautilus_trader

2. Databento DBN files for MNQ — a definition file and an OHLCV file:

       databento download --dataset GLBX.MDP3 --symbols MNQ.c.0 \
         --stype-in continuous --schema definition --start ... --end ...
       databento download --dataset GLBX.MDP3 --symbols MNQ.c.0 \
         --stype-in continuous --schema ohlcv-1m --start ... --end ...

3. Setups from the TypeScript scanner, which is the single source of signals:

       npm run dev
       curl 'http://localhost:3000/api/mnq/scan?limit=5000&minScore=60' > setups.json

Then:

    python run_backtest.py --data-dir ./dbn --setups setups.json \
      --publishers /path/to/nautilus_trader/crates/adapters/databento/publishers.json

NOT RUN in this environment: nautilus_trader is not installed here and
Databento is a paid feed. This is reviewed, API-accurate code awaiting a first
execution, not a verified result.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from nautilus_trader.adapters.databento import DatabentoDataLoader
from nautilus_trader.backtest import BacktestEngine
from nautilus_trader.config import BacktestEngineConfig
from nautilus_trader.model import (
    AccountType,
    BarType,
    Currency,
    InstrumentId,
    Money,
    OmsType,
    TraderId,
    Venue,
)

from strategy import MnqSetupConfig, MnqSetupStrategy


def main() -> None:
    parser = argparse.ArgumentParser(description="MNQ setup backtest on Nautilus v2")
    parser.add_argument("--data-dir", required=True, type=Path, help="Directory of .dbn.zst files")
    parser.add_argument("--setups", required=True, type=Path, help="setups.json from /api/mnq/scan")
    parser.add_argument("--publishers", required=True, type=Path, help="Databento publishers.json")
    parser.add_argument("--instrument", default="MNQZ6.XCME", help="Resolved contract, e.g. MNQZ6.XCME")
    parser.add_argument("--account", type=float, default=50_000.0)
    parser.add_argument("--drawdown", type=float, default=2_000.0)
    parser.add_argument("--drawdown-mode", default="trailing-intraday",
                        choices=["trailing-intraday", "trailing-eod", "static"])
    args = parser.parse_args()

    loader = DatabentoDataLoader(args.publishers)

    definitions = sorted(args.data_dir.glob("*definition*.dbn.zst"))
    ohlcv = sorted(args.data_dir.glob("*ohlcv*.dbn.zst"))
    if not definitions or not ohlcv:
        raise SystemExit(
            f"Need a definition and an ohlcv .dbn.zst in {args.data_dir}. "
            f"Found {len(definitions)} definition, {len(ohlcv)} ohlcv.",
        )

    instruments = loader.load_instruments(definitions[0], use_exchange_as_venue=True)
    bars = [bar for path in ohlcv for bar in loader.load_bars(path)]
    print(f"Loaded {len(instruments)} instruments and {len(bars)} bars")

    instrument_id = InstrumentId.from_str(args.instrument)
    venue = Venue("XCME")
    usd = Currency.from_str("USD")

    engine = BacktestEngine(BacktestEngineConfig(trader_id=TraderId.from_str("MNQ-ENGINE-001")))
    engine.add_venue(
        venue=venue,
        oms_type=OmsType.NETTING,
        account_type=AccountType.MARGIN,
        base_currency=usd,
        # Deliberately the real evaluation size, not a million dollars. A
        # backtest funded far above the account being modelled will happily
        # trade through a drawdown the real account would not have survived.
        starting_balances=[Money(args.account, usd)],
    )

    for instrument in instruments:
        engine.add_instrument(instrument)
    engine.add_data(bars)

    engine.add_strategy(
        MnqSetupStrategy(
            MnqSetupConfig(
                instrument_id=instrument_id,
                bar_type=BarType.from_str(f"{instrument_id}-1-MINUTE-LAST-EXTERNAL"),
                setups_path=str(args.setups),
                account_size=args.account,
                drawdown_amount=args.drawdown,
                drawdown_mode=args.drawdown_mode,
            ),
        ),
    )

    engine.run()

    print(engine.generate_account_report(venue))
    print(engine.generate_order_fills_report())
    print(engine.generate_positions_report())


if __name__ == "__main__":
    main()

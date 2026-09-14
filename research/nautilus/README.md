# Research harness

Two things live here, and they answer different questions.

| | Question | Runs here? |
| --- | --- | --- |
| `prop_sim.py` | What fraction of evaluation attempts does this strategy survive? | **Yes** — stdlib only |
| `strategy.py` + `run_backtest.py` | What happens with real fills, slippage and commissions? | No — needs NautilusTrader v2 and Databento |

## The pipeline

```
lib/mnq/*.ts                 signal logic — the single source of truth
      │
      ├─► /engine            the dashboard a trader reads
      │
      └─► GET /api/mnq/scan  setups + realised R as JSON
                 │
                 ├─► run_backtest.py   execution realism via Nautilus
                 └─► prop_sim.py       P(pass) under prop rules
```

Signals are **not** re-implemented in Python. Two implementations agree until
the first change to either, and a backtest of code you don't trade is worse
than no backtest. Nautilus is here for what it is actually good at — fills,
slippage, commissions, margin — not for re-deriving order blocks.

## prop_sim.py — the one that matters

```bash
python3 prop_sim.py
python3 prop_sim.py --win-rate 0.45 --rr 2 --risk 250 --trades-per-day 3
curl 'localhost:3000/api/mnq/scan?limit=5000' | jq '.realisedR' > r.json
python3 prop_sim.py --trades-json r.json
python3 test_prop_sim.py          # 13 tests
```

A prop evaluation is a **ruin problem, not a profitability problem**. It is
killed by a path, not by an average, and a strategy with strong expectancy and
lumpy equity fails a drawdown rule that a worse, smoother one walks through.

Measured, holding the trade distribution fixed at 40% win rate / 2R / +0.20R
expectancy, floor never locking:

| Drawdown mode | P(pass) | P(breach) |
| --- | --- | --- |
| Trailing, intraday (unrealised) | 53.5% | 46.5% |
| Trailing, end of day | 61.6% | 38.4% |
| Static | 80.8% | 18.9% |

**Identical trades. 53.5% versus 80.8%, purely from the drawdown rule.** Which
firm you sign with is a larger factor in whether you get funded than a good
chunk of strategy work.

### On give-back

Under intraday trailing, the floor follows peak equity *including open profit*
and never retreats — a trade that runs +3R and closes at +0.2R still raises the
kill line by 3R of dollars. `--mfe-r` models how far a loser travels in your
favour before reversing.

The result was not what I expected going in:

| Loser's excursion | P(pass) |
| --- | --- |
| 0% of target | 54.5% |
| 25% | 54.5% |
| 50% | 54.5% |
| 75% | 50.8% |
| 100% | 48.9% |

Give-back is **flat until roughly 1.5R excursions**, because winners already
set the peak and losers' smaller excursions rarely exceed it. It only bites
once losers routinely run most of the way to target before turning. That is
measured, not assumed.

### What this model does not include

Commissions and slippage (that is the Nautilus half), sequence effects from
sizing off remaining room, discretionary deviation, and any correlation between
trades — outcomes are drawn independently, which flatters a strategy whose
losers cluster.

## Nautilus half

Written against **v2.0.0rc5** (Rust + PyO3). v1 import paths do not work; see
upstream `MIGRATION_V2.md`. v1 and v2 both import as `nautilus_trader`, so use
separate virtualenvs.

```bash
uv venv --python 3.14 && source .venv/bin/activate
uv pip install --pre nautilus_trader

curl 'localhost:3000/api/mnq/scan?limit=5000&minScore=60' > setups.json
python run_backtest.py --data-dir ./dbn --setups setups.json \
  --publishers /path/to/nautilus_trader/crates/adapters/databento/publishers.json
```

The backtest funds the venue at the **real evaluation size**, not a notional
million. A backtest funded far above the account being modelled trades happily
through a drawdown the real account would not have survived.

Exits are managed bar by bar with market orders rather than resting brackets:
it uses only v2 APIs verified against upstream examples, and keeps fill logic
explicit. A bar touching both stop and target resolves as the loss — from bar
data there is no way to know which came first, and assuming the good one is how
backtests lie.

**Neither Python file here has been executed against a live install.** No
`nautilus_trader` in this environment, and Databento is paid. They are
API-accurate and reviewed, not verified results. `prop_sim.py` is the part that
actually runs and is tested.

## Reality check

Nautilus has **no adapter for any futures prop platform** — no Rithmic,
Tradovate, ProjectX, NinjaTrader or MT5. Its execution venues are crypto
exchanges, Interactive Brokers and Betfair. A Rithmic adapter was proposed
upstream (RFC #3768, March 2026) and closed with no merge.

So this half is a **research tool, not an order router**. If a strategy earns
its place here, routing to a prop account is a separate, direct integration
against Tradovate's or ProjectX's own API.

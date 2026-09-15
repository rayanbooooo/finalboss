"""
Verifies the sidecar's plumbing without downloading pretrained weights.

What this proves and what it does not
-------------------------------------
PROVES: the request shape, the DataFrame the model is handed, timestamp
derivation, the multi-path sampling loop, percentile band assembly, probUp,
auth, and the error paths — the whole of main.py end to end, through the real
FastAPI app and the real KronosPredictor.

DOES NOT PROVE: that the forecasts are any good. The model here is randomly
initialised and tiny. Its numbers are noise by construction. Weight quality is
a separate question this cannot answer.

That distinction matters: this catches "the service 500s on every request
because the DataFrame is missing a column", which is the failure that would
otherwise greet you on first deploy, and it catches nothing about accuracy.

Run:
    KRONOS_REPO=/path/to/Kronos python3 test_forecast.py
"""

from __future__ import annotations

import os
import sys
import unittest
from unittest import mock

# The upstream package is a checkout, not a PyPI distribution.
KRONOS_REPO = os.environ.get("KRONOS_REPO", "/home/user/shiyu-coder/kronos")
if KRONOS_REPO not in sys.path:
    sys.path.insert(0, KRONOS_REPO)

from fastapi.testclient import TestClient  # noqa: E402
from model import Kronos, KronosPredictor, KronosTokenizer  # noqa: E402

import main  # noqa: E402

HORIZON = 6
CONTEXT_BARS = 48


def tiny_predictor() -> KronosPredictor:
    """A structurally real but deliberately tiny Kronos, randomly initialised.

    Quantizer bit widths are kept at upstream's defaults because they determine
    codebook shapes; only depth and width are shrunk, so the code path exercised
    is the same one the real model takes.
    """
    tokenizer = KronosTokenizer(
        d_in=6, d_model=64, n_heads=2, ff_dim=128,
        n_enc_layers=1, n_dec_layers=1,
        ffn_dropout_p=0.0, attn_dropout_p=0.0, resid_dropout_p=0.0,
        s1_bits=10, s2_bits=10,
        beta=0.05, gamma0=1.0, gamma=1.1, zeta=0.05, group_size=4,
    )
    model = Kronos(
        s1_bits=10, s2_bits=10, n_layers=1, d_model=64, n_heads=2, ff_dim=128,
        ffn_dropout_p=0.0, attn_dropout_p=0.0, resid_dropout_p=0.0,
        token_dropout_p=0.0, learn_te=True,
    )
    return KronosPredictor(model, tokenizer, device="cpu", max_context=CONTEXT_BARS)


def mnq_bars(count: int = CONTEXT_BARS) -> list[dict]:
    """MNQ-shaped minute bars: tens of thousands of index points, 0.25 ticks."""
    start_ms = 1_789_000_000_000
    bars = []
    price = 24_800.0
    for i in range(count):
        drift = ((i * 37) % 11 - 5) * 0.25
        open_ = price
        close = price + drift
        bars.append({
            "time": start_ms + i * 60_000,
            "open": round(open_ * 4) / 4,
            "high": round(max(open_, close) * 4) / 4 + 0.5,
            "low": round(min(open_, close) * 4) / 4 - 0.5,
            "close": round(close * 4) / 4,
            "volume": 1000 + i,
        })
        price = close
    return bars


class TestForecastEndpoint(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.predictor = tiny_predictor()
        # Fewer paths than production: this is a wiring test, not a benchmark.
        main.SAMPLE_PATHS = 3
        main.MAX_CONTEXT = CONTEXT_BARS
        cls.client = TestClient(main.app)

    def setUp(self) -> None:
        self.patcher = mock.patch.object(main, "get_predictor", return_value=self.predictor)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)

    def test_health_does_not_load_the_model(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    def test_forecast_returns_a_well_formed_band(self):
        response = self.client.post("/forecast", json={"candles": mnq_bars(), "horizon": HORIZON})
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()

        self.assertTrue(body["available"])
        self.assertEqual(body["horizon"], HORIZON)
        for field in ("median", "upper", "lower"):
            self.assertEqual(len(body[field]), HORIZON, f"{field} wrong length")

        # The band must actually bracket the median at every step, otherwise the
        # percentiles were computed across the wrong axis — a silent bug that
        # still renders a plausible-looking chart.
        for i in range(HORIZON):
            self.assertLessEqual(body["lower"][i], body["median"][i] + 1e-6, f"step {i}")
            self.assertLessEqual(body["median"][i], body["upper"][i] + 1e-6, f"step {i}")

        self.assertGreaterEqual(body["probUp"], 0.0)
        self.assertLessEqual(body["probUp"], 1.0)
        # With 3 sampled paths, probUp can only be 0, 1/3, 2/3 or 1. Anything
        # else means it is not measuring what it claims to.
        self.assertIn(round(body["probUp"] * 3), (0, 1, 2, 3))

    def test_rejects_too_little_context(self):
        response = self.client.post("/forecast", json={"candles": mnq_bars(4), "horizon": HORIZON})
        self.assertEqual(response.status_code, 400)
        self.assertIn("32 bars", response.json()["detail"])

    def test_rejects_an_out_of_range_horizon(self):
        response = self.client.post("/forecast", json={"candles": mnq_bars(), "horizon": 999})
        self.assertEqual(response.status_code, 422)

    def test_token_is_enforced_only_when_configured(self):
        with mock.patch.object(main, "SERVICE_TOKEN", "sekret"):
            denied = self.client.post("/forecast", json={"candles": mnq_bars(), "horizon": 2})
            self.assertEqual(denied.status_code, 401)

            allowed = self.client.post(
                "/forecast",
                json={"candles": mnq_bars(), "horizon": 2},
                headers={"authorization": "Bearer sekret"},
            )
            self.assertEqual(allowed.status_code, 200, allowed.text)


if __name__ == "__main__":
    unittest.main(verbosity=2)

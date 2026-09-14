"""
Kronos forecasting sidecar for the MNQ indices terminal.

Kronos is a PyTorch model and cannot run inside the Next.js process, so it
lives here as a small FastAPI service that the app's /api/forecast route
proxies to. The app treats this service as optional: with it absent, forecasts
are simply off and setup detection is unaffected.

Why sampling rather than a single prediction
--------------------------------------------
KronosPredictor.predict() averages internally when sample_count > 1 and hands
back one path. An average path is the least useful thing a generative model can
give you here — it smooths away exactly the tail behaviour a trader needs. So
this calls predict() repeatedly with sample_count=1 and keeps every path, then
reports a median, a band, and the share of paths that closed above the last
real close. That last number is the only one the dashboard scores on.

It uses the public API deliberately. Reaching into auto_regressive_inference to
pull per-sample tensors out in one pass would be faster and would break on the
next upstream refactor.

Model: https://github.com/shiyu-coder/Kronos  (MIT)
"""

from __future__ import annotations

import os
from typing import List, Optional

import numpy as np
import pandas as pd
import torch
from fastapi import Depends, FastAPI, HTTPException, Header
from pydantic import BaseModel, Field

from model import Kronos, KronosPredictor, KronosTokenizer

TOKENIZER_ID = os.environ.get("KRONOS_TOKENIZER", "NeoQuasar/Kronos-Tokenizer-base")
MODEL_ID = os.environ.get("KRONOS_MODEL", "NeoQuasar/Kronos-small")
MAX_CONTEXT = int(os.environ.get("KRONOS_MAX_CONTEXT", "512"))
# Paths sampled per request. More paths means a better-estimated band and a
# linearly longer response; 16 is a workable default on a small GPU.
SAMPLE_PATHS = int(os.environ.get("KRONOS_SAMPLES", "16"))
DEVICE = os.environ.get("KRONOS_DEVICE") or None
SERVICE_TOKEN = os.environ.get("KRONOS_SERVICE_TOKEN")

app = FastAPI(title="Kronos MNQ forecast sidecar", version="1.0.0")

_predictor: Optional[KronosPredictor] = None


def get_predictor() -> KronosPredictor:
    """Load the model once, on first use rather than at import.

    Loading at import makes the container fail its healthcheck while weights
    download, which reads as a crash loop rather than a slow start.
    """
    global _predictor
    if _predictor is None:
        tokenizer = KronosTokenizer.from_pretrained(TOKENIZER_ID)
        model = Kronos.from_pretrained(MODEL_ID)
        _predictor = KronosPredictor(model, tokenizer, device=DEVICE, max_context=MAX_CONTEXT)
    return _predictor


def require_token(authorization: str = Header(default="")) -> None:
    """Shared-secret auth, enforced only when a token is configured."""
    if not SERVICE_TOKEN:
        return
    if authorization != f"Bearer {SERVICE_TOKEN}":
        raise HTTPException(status_code=401, detail="Unauthorized")


class Candle(BaseModel):
    time: int = Field(description="Bar open time, milliseconds since epoch (UTC)")
    open: float
    high: float
    low: float
    close: float
    volume: float = 0.0


class ForecastRequest(BaseModel):
    candles: List[Candle]
    horizon: int = Field(default=24, ge=1, le=64)


class ForecastResponse(BaseModel):
    available: bool
    model: str
    horizon: int
    median: List[float]
    upper: List[float]
    lower: List[float]
    probUp: float
    note: Optional[str] = None


@app.get("/health")
def health() -> dict:
    """Liveness only. Deliberately does not touch the model, so an orchestrator
    can tell 'process up' apart from 'weights still downloading'."""
    return {"status": "ok", "model": MODEL_ID, "loaded": _predictor is not None}


@app.post("/forecast", response_model=ForecastResponse, dependencies=[Depends(require_token)])
def forecast(request: ForecastRequest) -> ForecastResponse:
    if len(request.candles) < 32:
        raise HTTPException(status_code=400, detail="Need at least 32 bars of context")

    predictor = get_predictor()

    frame = pd.DataFrame(
        {
            "open": [c.open for c in request.candles],
            "high": [c.high for c in request.candles],
            "low": [c.low for c in request.candles],
            "close": [c.close for c in request.candles],
            "volume": [c.volume for c in request.candles],
        }
    )
    # Kronos expects an `amount` (turnover) column. Upstream derives it the same
    # way when missing; doing it explicitly keeps the input well-formed.
    frame["amount"] = frame["volume"] * frame[["open", "high", "low", "close"]].mean(axis=1)

    timestamps = pd.to_datetime([c.time for c in request.candles], unit="ms", utc=True).tz_localize(None)
    x_timestamp = pd.Series(timestamps)

    # Future timestamps continue at the series' own cadence. The model consumes
    # minute/hour/weekday/day/month features, so these must be plausible clock
    # times, not indices. Note this walks straight through session closes: for
    # a 24-bar horizon on 1m MNQ that is immaterial, but a long horizon crossing
    # the 17:00 ET halt will carry slightly wrong time features.
    if len(timestamps) >= 2:
        step = timestamps[-1] - timestamps[-2]
    else:
        step = pd.Timedelta(minutes=1)
    y_timestamp = pd.Series([timestamps[-1] + step * (i + 1) for i in range(request.horizon)])

    context = frame.tail(MAX_CONTEXT).reset_index(drop=True)
    x_timestamp = x_timestamp.tail(MAX_CONTEXT).reset_index(drop=True)

    last_close = float(context["close"].iloc[-1])

    paths: List[np.ndarray] = []
    for index in range(SAMPLE_PATHS):
        # Distinct seed per path: without this every path is identical and the
        # band collapses to a line that looks like false confidence.
        torch.manual_seed(index + 1)
        predicted = predictor.predict(
            df=context,
            x_timestamp=x_timestamp,
            y_timestamp=y_timestamp,
            pred_len=request.horizon,
            T=1.0,
            top_p=0.9,
            sample_count=1,
            verbose=False,
        )
        paths.append(predicted["close"].to_numpy(dtype=float))

    stacked = np.vstack(paths)

    return ForecastResponse(
        available=True,
        model=MODEL_ID,
        horizon=request.horizon,
        median=np.median(stacked, axis=0).tolist(),
        upper=np.percentile(stacked, 90, axis=0).tolist(),
        lower=np.percentile(stacked, 10, axis=0).tolist(),
        # Share of sampled futures finishing above the last real close.
        probUp=float(np.mean(stacked[:, -1] > last_close)),
    )

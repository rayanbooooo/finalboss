"""
Run the sidecar with a randomly-initialised model, for frontend work.

The forecasts this produces are NOISE. It exists so the terminal's forecast
panel can be developed and tested without a GPU, without downloading weights,
and without network access to HuggingFace — the real service needs all three.

It is the same FastAPI app and the same KronosPredictor as production; only the
weights are fake. Never point a real deployment at this.

    KRONOS_REPO=/path/to/Kronos python3 dev_server.py --port 8000
"""

from __future__ import annotations

import argparse
import os
import sys

KRONOS_REPO = os.environ.get("KRONOS_REPO", "/home/user/shiyu-coder/kronos")
if KRONOS_REPO not in sys.path:
    sys.path.insert(0, KRONOS_REPO)

import uvicorn  # noqa: E402

import main  # noqa: E402
from test_forecast import tiny_predictor  # noqa: E402


def run() -> None:
    parser = argparse.ArgumentParser(description="Kronos sidecar with fake weights")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--samples", type=int, default=3)
    parser.add_argument("--context", type=int, default=48)
    args = parser.parse_args()

    predictor = tiny_predictor()
    # Replace the loader rather than the module attribute, so the FastAPI
    # dependency graph is untouched and the request path stays identical.
    main.get_predictor = lambda: predictor
    main.SAMPLE_PATHS = args.samples
    main.MAX_CONTEXT = args.context
    main.MODEL_ID = "dev/random-weights"

    print(f"⚠  Serving FAKE forecasts on :{args.port} — random weights, noise output.")
    uvicorn.run(main.app, host="127.0.0.1", port=args.port, log_level="warning")


if __name__ == "__main__":
    run()

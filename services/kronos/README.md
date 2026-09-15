# Kronos forecast sidecar

Wraps [shiyu-coder/Kronos](https://github.com/shiyu-coder/Kronos) (MIT) — a
decoder-only foundation model pre-trained on K-line sequences — behind a small
HTTP API that the MNQ terminal calls through `/api/forecast`.

## Why this is a separate service

Kronos is PyTorch. It cannot run inside the Next.js process, and there is no
JavaScript port worth using. This is a normal Python deployment that the app
talks to over HTTP.

**The app works without it.** With `KRONOS_SERVICE_URL` unset, `/api/forecast`
returns `available: false`, the forecast panel explains how to enable it, and
setup detection is completely unaffected. Forecasts are an overlay on the
scanner, never a dependency of it.

## What it returns

`predict()` averages internally when `sample_count > 1`, which throws away the
distribution — the useful part of a generative model. So the service samples
`KRONOS_SAMPLES` independent paths and reports:

| Field | Meaning |
| --- | --- |
| `median` | Per-step median close across sampled paths |
| `upper` / `lower` | 90th / 10th percentile band |
| `probUp` | Share of paths whose final close beat the last real close |

`probUp` is the only field the dashboard scores on, and it is deliberately
banded: 0.45–0.55 counts as no information. A foundation model that is 52%
confident on noisy intraday futures is not confident.

## Turning it on (what the OFFLINE panel is asking for)

The panel reads `available: false` because `KRONOS_SERVICE_URL` is unset. Three
steps, and only the second one costs anything:

**1. Deploy this directory somewhere that runs Python.** It cannot go on Vercel
alongside the app — Vercel's Node runtime cannot host a PyTorch model. Pick one:

```bash
docker compose up                       # local, simplest
fly launch --no-deploy && fly deploy    # fly.toml included
render blueprint launch                 # render.yaml included
```

**2. Check it is alive**, and expect the first request to be slow — weights
download on first use, not at boot:

```bash
curl https://<your-sidecar>/health
# {"status":"ok","model":"NeoQuasar/Kronos-mini","loaded":false}
```

**3. Set the variable in Vercel** (Project → Settings → Environment Variables),
then redeploy so it takes effect:

```
KRONOS_SERVICE_URL   = https://<your-sidecar>
KRONOS_SERVICE_TOKEN = <the same secret set on the sidecar>
```

Set the token. A sidecar on a public URL with no token is an open inference
endpoint running on your bill.

### CPU is the real constraint

The bundled configs pin **Kronos-mini** (4.1M params, 2048 context) with four
sampled paths, because that is what survives a CPU box. Kronos-small at the
default 16 paths takes minutes per request on CPU — that is not a forecast,
it is a timeout. Raise `KRONOS_SAMPLES` and move up to `-small` or `-base` only
on a GPU instance.

Note the tokenizer must match the model: `Kronos-mini` pairs with
`Kronos-Tokenizer-2k`, `-small` and `-base` with `Kronos-Tokenizer-base`.

## Run it

```bash
docker build -t kronos-sidecar .
docker run -p 8000:8000 \
  -v kronos-weights:/app/.cache/huggingface \
  -e KRONOS_MODEL=NeoQuasar/Kronos-small \
  kronos-sidecar
```

Then point the app at it:

```bash
KRONOS_SERVICE_URL=http://localhost:8000
KRONOS_SERVICE_TOKEN=some-shared-secret   # optional, enforced when set
```

Locally without Docker:

```bash
git clone --depth 1 https://github.com/shiyu-coder/Kronos.git
pip install -r requirements.txt
PYTHONPATH=$PWD/Kronos uvicorn main:app --port 8000
```

## Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `KRONOS_MODEL` | `NeoQuasar/Kronos-small` | `-mini` (4.1M, 2048 ctx), `-small` (24.7M, 512), `-base` (102.3M, 512) |
| `KRONOS_TOKENIZER` | `NeoQuasar/Kronos-Tokenizer-base` | Use `-2k` with `Kronos-mini` |
| `KRONOS_MAX_CONTEXT` | `512` | Must match the model's window |
| `KRONOS_SAMPLES` | `16` | Paths per request; response time scales linearly |
| `KRONOS_DEVICE` | auto | `cuda:0`, `mps`, or `cpu` |
| `KRONOS_SERVICE_TOKEN` | unset | Bearer token; auth is off when unset |

## Honest limitations

- **Not verified end-to-end here.** The service is written against the upstream
  `KronosPredictor` signature as it exists in the repo, but it has not been run
  against real weights in this environment — no GPU, and the weights are not
  downloaded. Run `/health`, then a real `/forecast`, before relying on it.
- **CPU is slow.** 16 sampled paths at a 24-bar horizon is minutes on CPU, not
  seconds. Use a GPU, drop `KRONOS_SAMPLES`, or cache aggressively.
- **Future timestamps ignore session closes.** `y_timestamp` continues at the
  bar cadence, so a long horizon crossing the 17:00 ET halt feeds the model
  slightly wrong time features. Immaterial at a 24-bar horizon on 1m bars.
- **Pin `KRONOS_REF`.** The Dockerfile defaults to `main`. A moving dependency
  that produces trading signals is a risk, not a dependency.
- **Upstream's README news is dated Nov 2025.** Check the commit history before
  building anything load-bearing on this.

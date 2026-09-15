import type { Candle } from "@/types/market";
import { MNQ, roundToTick } from "@/lib/mnq/contract";
import { etParts, isMarketOpen, isKillzone, sessionAt } from "@/lib/mnq/sessions";

/**
 * MNQ bar sources behind one interface.
 *
 * There are exactly two implementations and they are not interchangeable in
 * the way that matters: one is real CME data and one is invented. Every bar
 * set carries `isLive` so the dashboard can say which it is showing, because a
 * terminal that renders synthetic prices in the same chrome as real ones is a
 * trap — the setups look identical and only one of them is worth acting on.
 */

export interface MnqBarRequest {
  /** Bar interval in milliseconds. 60_000 for 1m, 300_000 for 5m. */
  intervalMs: number;
  limit: number;
  /** End of the window. Defaults to now. */
  endMs?: number;
}

export interface MnqBars {
  symbol: string;
  candles: Candle[];
  source: "simulated" | "databento" | "yahoo";
  /** True only for real exchange data. */
  isLive: boolean;
  /** Shown under the LIVE / SIMULATED badge. */
  note: string;
}

export interface MnqBarSource {
  id: "simulated" | "databento" | "yahoo";
  label: string;
  isLive: boolean;
  fetchBars(request: MnqBarRequest): Promise<MnqBars>;
}

/* -------------------------------------------------------------------------
 * Simulated source
 * ---------------------------------------------------------------------- */

/** Deterministic PRNG. Seeded so server and client render identical bars. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Volatility multiplier by session.
 *
 * Not decoration: it is what makes the simulated series produce killzone
 * setups in the killzones and nothing much at lunch, so the dashboard's
 * session logic is exercised rather than merely displayed.
 */
function sessionVolatility(timestampMs: number): number {
  const session = sessionAt(timestampMs);
  if (!session) return 0.45;
  switch (session.id) {
    case "ny-am":
      return 1.6;
    case "ny-pm":
      return 1.15;
    case "london":
      return 1.0;
    case "ny-lunch":
      return 0.35;
    default:
      return 0.5;
  }
}

export interface SimulatorOptions {
  /** Anchor price. MNQ trades in the tens of thousands of index points. */
  basePrice: number;
  /** Typical per-bar range in index points at 1m, before session scaling. */
  baseRangePoints: number;
  seed: number;
}

export const DEFAULT_SIMULATOR_OPTIONS: SimulatorOptions = {
  basePrice: 24_800,
  baseRangePoints: 9,
  seed: 20260914,
};

/**
 * Generate bars with the structure the scanner is built to find.
 *
 * A plain random walk almost never produces clean order blocks or liquidity
 * raids, so this runs a small regime machine: directional legs that persist,
 * pullbacks against them, and occasional stop-run bars with a long wick that
 * closes back inside. That is not an attempt to flatter the strategy — the
 * resolver still marks the outcome honestly — it is so the UI and the engine
 * are exercised on data shaped like the real thing.
 *
 * Bars are only emitted when the CME session is open, so weekend and
 * maintenance-hour gaps appear exactly as they do in real data.
 */
export function generateMnqCandles(request: MnqBarRequest, options: Partial<SimulatorOptions> = {}): Candle[] {
  const opts = { ...DEFAULT_SIMULATOR_OPTIONS, ...options };
  const { intervalMs, limit } = request;
  const endMs = request.endMs ?? Date.now();

  // Collect open timestamps backwards, then build forwards so the price path
  // runs in chronological order.
  const times: number[] = [];
  let cursor = Math.floor(endMs / intervalMs) * intervalMs;
  let guard = 0;
  while (times.length < limit && guard < limit * 40) {
    if (isMarketOpen(cursor)) times.push(cursor);
    cursor -= intervalMs;
    guard += 1;
  }
  times.reverse();

  const random = mulberry32(opts.seed);
  const candles: Candle[] = [];

  let price = opts.basePrice;
  let legDirection: 1 | -1 = random() > 0.5 ? 1 : -1;
  let legRemaining = 20 + Math.floor(random() * 40);
  let pullbackRemaining = 0;

  for (const time of times) {
    const volatility = sessionVolatility(time) * opts.baseRangePoints;

    if (legRemaining <= 0) {
      legDirection = random() > 0.5 ? 1 : -1;
      legRemaining = 20 + Math.floor(random() * 40);
    }
    // Pullbacks against the leg are what leave fair value gaps and order
    // blocks behind for price to return into.
    if (pullbackRemaining <= 0 && random() < 0.12) {
      pullbackRemaining = 3 + Math.floor(random() * 5);
    }

    const direction: 1 | -1 = pullbackRemaining > 0 ? (-legDirection as 1 | -1) : legDirection;

    /*
     * Bars are built range-first rather than by accumulating drift and noise.
     *
     * The drift-and-noise version produced a median ATR of 3.7 points with
     * two-point bars — a market roughly a quarter as volatile as real MNQ, and
     * one where essentially no bar body ever reached 1.2x ATR. The scanner
     * correctly found almost nothing in it, which looked like a scanner bug
     * and was actually a data bug. Specifying the range and the body fraction
     * directly makes both controllable and keeps displacement bars possible.
     */
    const impulse = isKillzone(time) && random() < 0.06;
    const range = volatility * (impulse ? 1.8 + random() * 1.2 : 0.5 + random() * 1.0);
    // Impulse bars are mostly body: that is what displacement means.
    const bodyFraction = impulse ? 0.65 + random() * 0.28 : 0.2 + random() * 0.45;
    const body = range * bodyFraction;

    const open = price;
    let close = open + direction * body;

    // The rest of the range becomes wicks, split unevenly.
    const remainder = Math.max(0, range - body);
    const upperShare = random();
    let high = Math.max(open, close) + remainder * upperShare;
    let low = Math.min(open, close) - remainder * (1 - upperShare);

    // Stop run: a long wick through recent extremes that closes back inside.
    // Only in killzones, which is where they actually happen.
    if (isKillzone(time) && !impulse && random() < 0.07 && candles.length > 6) {
      const recent = candles.slice(-6);
      if (direction > 0) {
        low = Math.min(low, Math.min(...recent.map((c) => c.low)) - volatility * 0.5);
        close = Math.max(close, open + range * 0.2);
      } else {
        high = Math.max(high, Math.max(...recent.map((c) => c.high)) + volatility * 0.5);
        close = Math.min(close, open - range * 0.2);
      }
    }

    high = Math.max(high, open, close);
    low = Math.min(low, open, close);

    candles.push({
      time,
      open: roundToTick(open),
      high: roundToTick(high),
      low: roundToTick(low),
      close: roundToTick(close),
      // Volume tracks session activity, and spikes on displacement.
      volume: Math.round((400 + sessionVolatility(time) * 900 * (0.6 + random() * 0.8)) * (impulse ? 2.4 : 1)),
    });

    price = close;
    legRemaining -= 1;
    if (pullbackRemaining > 0) pullbackRemaining -= 1;
  }

  return candles;
}

export function createSimulatedMnqSource(options: Partial<SimulatorOptions> = {}): MnqBarSource {
  return {
    id: "simulated",
    label: "Simulated MNQ",
    isLive: false,
    async fetchBars(request) {
      return {
        symbol: MNQ.symbol,
        candles: generateMnqCandles(request, options),
        source: "simulated",
        isLive: false,
        note: "Synthetic MNQ. Structure is realistic, prices are invented. Do not trade these levels.",
      };
    },
  };
}

/* -------------------------------------------------------------------------
 * Databento source
 * ---------------------------------------------------------------------- */

const DATABENTO_BASE = "https://hist.databento.com/v0";

/**
 * Real CME MNQ bars via Databento's historical HTTP API.
 *
 * Uses the continuous front-month symbol (MNQ.c.0) under the `continuous`
 * stype so the series rolls at expiry instead of dying every quarter, which is
 * the failure mode of hardcoding MNQZ6 and wondering why the chart stopped in
 * December.
 *
 * Databento is paid. Without DATABENTO_API_KEY the app falls back to the
 * simulator rather than erroring, so the dashboard is always usable.
 */
export function createDatabentoSource(apiKey: string): MnqBarSource {
  return {
    id: "databento",
    label: "Databento · CME MNQ",
    isLive: true,
    async fetchBars(request) {
      const schema = intervalToSchema(request.intervalMs);
      const endMs = request.endMs ?? Date.now();
      // Over-fetch: the window is wall-clock, but closed sessions return no
      // bars, so asking for exactly `limit` intervals comes back short.
      const startMs = endMs - request.intervalMs * request.limit * 4;

      const params = new URLSearchParams({
        dataset: "GLBX.MDP3",
        symbols: "MNQ.c.0",
        stype_in: "continuous",
        schema,
        start: new Date(startMs).toISOString(),
        end: new Date(endMs).toISOString(),
        encoding: "json",
      });

      const response = await fetch(`${DATABENTO_BASE}/timeseries.get_range?${params}`, {
        headers: {
          // Databento uses HTTP basic auth with the key as the username.
          authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Databento responded ${response.status}`);
      }

      const candles = parseDatabentoJsonl(await response.text()).slice(-request.limit);

      return {
        symbol: MNQ.symbol,
        candles,
        source: "databento",
        isLive: true,
        note: "CME MNQ front-month continuous via Databento.",
      };
    },
  };
}

function intervalToSchema(intervalMs: number): string {
  if (intervalMs <= 60_000) return "ohlcv-1m";
  if (intervalMs <= 300_000) return "ohlcv-1m";
  if (intervalMs <= 3_600_000) return "ohlcv-1h";
  return "ohlcv-1d";
}

/**
 * Databento streams newline-delimited JSON, with prices as fixed-point
 * integers scaled by 1e9 and timestamps in nanoseconds.
 */
const DATABENTO_PRICE_SCALE = 1e9;

export function parseDatabentoJsonl(body: string): Candle[] {
  const candles: Candle[] = [];

  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const row = JSON.parse(trimmed) as {
        hd?: { ts_event?: string };
        ts_event?: string;
        open?: string | number;
        high?: string | number;
        low?: string | number;
        close?: string | number;
        volume?: string | number;
      };

      const tsNanos = Number(row.hd?.ts_event ?? row.ts_event ?? 0);
      if (!tsNanos) continue;

      candles.push({
        time: Math.floor(tsNanos / 1e6),
        open: Number(row.open) / DATABENTO_PRICE_SCALE,
        high: Number(row.high) / DATABENTO_PRICE_SCALE,
        low: Number(row.low) / DATABENTO_PRICE_SCALE,
        close: Number(row.close) / DATABENTO_PRICE_SCALE,
        volume: Number(row.volume ?? 0),
      });
    } catch {
      // A malformed line should cost one bar, not the whole request.
      continue;
    }
  }

  return candles.sort((a, b) => a.time - b.time);
}

/* -------------------------------------------------------------------------
 * Yahoo source — real prices, free, no key
 * ---------------------------------------------------------------------- */

const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

/**
 * Yahoo symbols to try, in order.
 *
 * MNQ=F is the exact instrument. NQ=F is the fallback and is NOT a compromise
 * on price: the Micro and the E-mini are written on the same index, so their
 * quotes in index points are the same series — only the contract multiplier
 * differs ($2 vs $20 a point), and that lives in contract.ts, not here. The
 * E-mini is far more heavily traded, so its bars are usually the cleaner ones.
 */
const YAHOO_SYMBOLS = ["MNQ=F", "NQ=F"] as const;

/** Yahoo caps 1m history at ~7 days and 5m/15m at ~60. Asking for more returns
 * an error rather than silently truncating. */
function yahooParams(intervalMs: number): { interval: string; range: string } {
  if (intervalMs <= 60_000) return { interval: "1m", range: "7d" };
  if (intervalMs <= 300_000) return { interval: "5m", range: "60d" };
  if (intervalMs <= 900_000) return { interval: "15m", range: "60d" };
  return { interval: "1h", range: "730d" };
}

interface YahooChartResponse {
  chart?: {
    result?: {
      timestamp?: number[];
      indicators?: {
        quote?: {
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }[];
      };
    }[];
    error?: { description?: string } | null;
  };
}

/**
 * Parse Yahoo's chart payload into candles.
 *
 * Yahoo pads its arrays with nulls for bars that did not trade — holidays, the
 * CME maintenance hour, thin overnight minutes. Those must be dropped rather
 * than coerced, because Number(null) is 0 and a single zero-priced bar wrecks
 * every ATR, swing and zone computed downstream.
 */
export function parseYahooChart(payload: unknown): Candle[] {
  const result = (payload as YahooChartResponse)?.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const times = result?.timestamp;
  if (!times || !quote) return [];

  const candles: Candle[] = [];
  for (let i = 0; i < times.length; i++) {
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];

    if (
      typeof open !== "number" || typeof high !== "number" ||
      typeof low !== "number" || typeof close !== "number" ||
      !Number.isFinite(open) || !Number.isFinite(high) ||
      !Number.isFinite(low) || !Number.isFinite(close)
    ) {
      continue;
    }

    candles.push({
      time: times[i] * 1000,
      open: roundToTick(open),
      high: roundToTick(high),
      low: roundToTick(low),
      close: roundToTick(close),
      volume: typeof quote.volume?.[i] === "number" ? (quote.volume[i] as number) : 0,
    });
  }

  return candles.sort((a, b) => a.time - b.time);
}

/**
 * Free real Nasdaq futures bars from Yahoo.
 *
 * This is an undocumented endpoint, not a supported API. It can change or
 * rate-limit without notice, quotes are typically delayed rather than
 * real-time, and history is short. That is the trade for needing no key and no
 * card — good enough to tune a scanner against real price behaviour, not good
 * enough to run size against. Databento remains the path for that, and takes
 * priority whenever a key is configured.
 */
export function createYahooSource(): MnqBarSource {
  return {
    id: "yahoo",
    label: "Yahoo · Nasdaq futures",
    isLive: true,
    async fetchBars(request) {
      const { interval, range } = yahooParams(request.intervalMs);
      let lastError: unknown = null;

      for (const symbol of YAHOO_SYMBOLS) {
        try {
          const response = await fetch(
            `${YAHOO_BASE}/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`,
            {
              // Yahoo returns 403 to requests without a browser-ish UA.
              headers: { "user-agent": "Mozilla/5.0", accept: "application/json" },
              cache: "no-store",
            },
          );
          if (!response.ok) {
            lastError = new Error(`Yahoo responded ${response.status} for ${symbol}`);
            continue;
          }

          const candles = parseYahooChart(await response.json()).slice(-request.limit);
          // A handful of bars is a malformed response, not a quiet session.
          if (candles.length < 32) {
            lastError = new Error(`Yahoo returned ${candles.length} usable bars for ${symbol}`);
            continue;
          }

          return {
            symbol: MNQ.symbol,
            candles,
            source: "yahoo",
            isLive: true,
            note:
              symbol === "MNQ=F"
                ? "Micro E-mini Nasdaq futures via Yahoo. Delayed, not real-time."
                : "E-mini Nasdaq (NQ) futures via Yahoo — same index, same points as MNQ; only the $2/pt multiplier differs. Delayed, not real-time.",
          };
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError instanceof Error ? lastError : new Error("Yahoo unavailable");
    },
  };
}

/**
 * Pick a source from the environment.
 *
 * Databento when a key is configured, otherwise free real bars from Yahoo,
 * otherwise the simulator. Server-side only — DATABENTO_API_KEY is deliberately
 * not NEXT_PUBLIC, so the key never reaches the browser and the bars route is
 * the only thing that can spend the user's Databento quota.
 *
 * MNQ_FORCE_SOURCE pins one source for debugging, so a Yahoo outage can be told
 * apart from a parsing bug without editing code.
 */
export function resolveMnqSource(): MnqBarSource {
  const forced = process.env.MNQ_FORCE_SOURCE;
  if (forced === "simulated") return createSimulatedMnqSource();
  if (forced === "yahoo") return createYahooSource();

  const key = process.env.DATABENTO_API_KEY;
  if (key) return createDatabentoSource(key);
  return createYahooSource();
}

/** Group bars into ET trading days, for day-scoped stats. */
export function groupByTradingDay(candles: Candle[]): Map<string, Candle[]> {
  const days = new Map<string, Candle[]>();
  for (const candle of candles) {
    const key = etParts(candle.time).dateKey;
    const list = days.get(key) ?? [];
    list.push(candle);
    days.set(key, list);
  }
  return days;
}

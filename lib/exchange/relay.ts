/**
 * Client side of the relay. Sends an already-signed request and unwraps
 * Bybit's envelope, which reports business errors inside a 200 response via
 * `retCode`, so an HTTP-status-only check would silently treat a rejected
 * order as a success.
 */

import { getSupabase } from "@/lib/supabase";
import { ExchangeError, type SignedRequest } from "@/lib/exchange/types";
import { BYBIT_HOSTS, setClockOffset } from "@/lib/exchange/bybit";

const RELAY_PATH = "/api/exchange";

interface BybitEnvelope {
  retCode?: number;
  retMsg?: string;
  result?: Record<string, unknown>;
}

async function authHeader(): Promise<Record<string, string>> {
  const supabase = getSupabase();
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function send<T = Record<string, unknown>>(
  request: SignedRequest
): Promise<T> {
  const response = await fetch(RELAY_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify(request),
  });

  const text = await response.text();
  let payload: BybitEnvelope & { error?: string };
  try {
    payload = JSON.parse(text) as BybitEnvelope & { error?: string };
  } catch {
    throw new ExchangeError("The exchange returned an unreadable response.", undefined, response.status);
  }

  if (!response.ok) {
    throw new ExchangeError(payload.error ?? "The exchange request failed.", undefined, response.status);
  }
  // retCode 0 is Bybit's only success value; everything else is an error
  // delivered inside a 200.
  if (payload.retCode !== 0) {
    throw new ExchangeError(payload.retMsg || "The exchange rejected the request.", payload.retCode);
  }

  return (payload.result ?? {}) as T;
}

/**
 * Measures how far this browser's clock is from the venue's, so signatures
 * carry a timestamp the venue will accept. Bybit rejects anything more than
 * a second ahead of its own clock, and browser clocks drift by seconds
 * routinely, so this is required rather than a refinement.
 */
export async function syncClock(testnet: boolean): Promise<number> {
  const response = await fetch(RELAY_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({
      testnet,
      method: "GET",
      path: "/v5/market/time",
      query: "",
      body: "",
      headers: {},
    }),
  });

  if (!response.ok) throw new ExchangeError("Could not read the exchange clock.");
  const payload = (await response.json()) as BybitEnvelope;
  const nanos = payload.result?.timeNano;
  const seconds = payload.result?.timeSecond;
  const serverMs = nanos
    ? Number(nanos) / 1e6
    : Number(seconds ?? 0) * 1000;

  if (!Number.isFinite(serverMs) || serverMs <= 0) {
    throw new ExchangeError("The exchange clock response was unreadable.");
  }

  const offset = Math.round(serverMs - Date.now());
  setClockOffset(offset);
  return offset;
}

/* ------------------------------------------------------------------------ *
 * Aster
 *
 * A separate path rather than a flag on `send`, because the two venues agree
 * on almost nothing about a response. Bybit answers 200 and hides failures in
 * `retCode`; Aster uses the HTTP status and answers errors as `{code, msg}`,
 * with a success body that may be a bare array. Folding both into one parser
 * produced a function whose every branch was "if Bybit... else Aster", which is
 * two functions wearing a coat.
 * ------------------------------------------------------------------------ */

/** Aster's error envelope. Present only on a non-2xx response. */
interface AsterError {
  code?: number;
  msg?: string;
}

/**
 * Aster's deposit gate.
 *
 * Since 1 September 2026 its authenticated V3 endpoints require the linked
 * main wallet to have deposited at least once. It is worth naming because it
 * is the first thing a new user hits, it says nothing about their API wallet
 * being wrong, and the venue's own wording - "This function can only be used
 * after deposit" - reads like a fault rather than a next step.
 */
export const ASTER_DEPOSIT_REQUIRED = -5050;

export interface AsterRelayRequest {
  /** Path only, e.g. "/fapi/v3/order". The host is chosen server-side. */
  path: string;
  method: "GET" | "POST";
  /** The signed payload string with `signature` already appended. */
  query: string;
  testnet: boolean;
}

/**
 * Sends a request the browser has already signed to Aster, through the relay.
 *
 * The signed payload rides in the query string for both GET and POST, which is
 * what Aster's reference implementation does and therefore what its server is
 * known to accept.
 */
export async function sendAster<T = unknown>(request: AsterRelayRequest): Promise<T> {
  const response = await fetch(RELAY_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({
      venue: "aster",
      testnet: request.testnet,
      method: request.method,
      path: request.path,
      query: request.query,
      body: "",
      headers: {},
    }),
  });

  const text = await response.text();

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new ExchangeError("The exchange returned an unreadable response.", undefined, response.status);
  }

  if (!response.ok) {
    const error = payload as AsterError & { error?: string };
    if (error.code === ASTER_DEPOSIT_REQUIRED) {
      throw new ExchangeError(
        "Aster requires a first deposit on your main wallet before it will " +
          "open an account. Deposit once on Aster, then reconnect here.",
        error.code,
        response.status
      );
    }
    throw new ExchangeError(
      error.msg || error.error || "The exchange rejected the request.",
      error.code,
      response.status
    );
  }

  return payload as T;
}

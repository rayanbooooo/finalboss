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

export const hostFor = (testnet: boolean) =>
  testnet ? BYBIT_HOSTS.testnet : BYBIT_HOSTS.mainnet;

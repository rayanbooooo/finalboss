/**
 * Bybit V5 request signing.
 *
 * Signing happens in the browser, never on our server - see lib/exchange/
 * crypto.ts for why. The output is a SignedRequest that the relay forwards
 * verbatim; because the signature covers the timestamp, key, recv-window and
 * the exact body bytes, the relay cannot alter the request without breaking
 * it.
 *
 * Scheme (V5): HMAC-SHA256 over `timestamp + apiKey + recvWindow + payload`,
 * lowercase hex, where payload is the query string for GET and the JSON body
 * for POST.
 */

import type {
  ExchangeCredentials,
  Instrument,
  KeyPermissions,
  LiveBalance,
  LivePosition,
  PlaceOrderParams,
  SignedRequest,
} from "@/lib/exchange/types";

export const BYBIT_HOSTS = {
  mainnet: "api.bybit.com",
  testnet: "api-testnet.bybit.com",
} as const;

/** Bybit rejects a request whose timestamp falls outside
 * `serverTime - recvWindow <= ts < serverTime + 1000`. */
const RECV_WINDOW = "5000";

/** Only these prefixes are ever signed or forwarded. Mirrored by the relay,
 * which enforces it independently rather than trusting the client. */
export const ALLOWED_PATH_PREFIXES = [
  "/v5/market/",
  "/v5/account/",
  "/v5/position/",
  "/v5/order/",
  "/v5/user/query-api",
] as const;

export function isAllowedPath(path: string): boolean {
  return ALLOWED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** The exact string Bybit signs. Exported so it can be asserted directly in
 * tests rather than only through its hash. */
export function buildSignPayload(
  timestamp: string,
  apiKey: string,
  recvWindow: string,
  payload: string
): string {
  return `${timestamp}${apiKey}${recvWindow}${payload}`;
}

export async function sign(
  apiSecret: string,
  message: string
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );
  return toHex(signature);
}

/**
 * Browser clocks drift by seconds routinely, and Bybit rejects a timestamp
 * more than 1s ahead of its own. This offset is measured once against the
 * venue's public time endpoint and applied to every signature.
 */
let clockOffsetMs = 0;

export function setClockOffset(offsetMs: number): void {
  clockOffsetMs = offsetMs;
}

export function getClockOffset(): number {
  return clockOffsetMs;
}

export function signedNow(): number {
  return Date.now() + clockOffsetMs;
}

export async function buildSignedRequest(
  credentials: ExchangeCredentials,
  method: "GET" | "POST",
  path: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<SignedRequest> {
  if (!isAllowedPath(path)) {
    throw new Error(`Refusing to sign a request to a non-allowlisted path: ${path}`);
  }

  const entries = Object.entries(params).filter(([, value]) => value !== undefined);
  const timestamp = String(signedNow());

  let query = "";
  let body = "";
  if (method === "GET") {
    query = new URLSearchParams(
      entries.map(([key, value]) => [key, String(value)])
    ).toString();
  } else {
    body = JSON.stringify(Object.fromEntries(entries));
  }

  const signature = await sign(
    credentials.apiSecret,
    buildSignPayload(timestamp, credentials.apiKey, RECV_WINDOW, method === "GET" ? query : body)
  );

  return {
    testnet: credentials.testnet,
    method,
    path,
    query,
    body,
    headers: {
      "X-BAPI-API-KEY": credentials.apiKey,
      "X-BAPI-TIMESTAMP": timestamp,
      "X-BAPI-RECV-WINDOW": RECV_WINDOW,
      "X-BAPI-SIGN": signature,
      "X-BAPI-SIGN-TYPE": "2",
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Response parsing. Bybit returns numbers as strings throughout, and uses ""
// rather than null for absent numerics, so every field goes through this.
// ---------------------------------------------------------------------------

function num(value: unknown): number {
  const parsed = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNum(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseKeyPermissions(result: Record<string, unknown>): KeyPermissions {
  const permissions = (result.permissions ?? {}) as Record<string, string[] | undefined>;
  const groups = Object.values(permissions).filter(Array.isArray) as string[][];
  const flat = groups.flat();

  // Bybit expresses withdrawal rights under the Wallet group. Anything that
  // mentions withdraw at all is treated as withdrawal-capable: erring toward
  // rejecting a usable key is much cheaper than accepting a dangerous one.
  const canWithdraw = flat.some((entry) => /withdraw/i.test(entry));
  const expiry = optionalNum(result.expiredAt);

  return {
    canTrade: flat.some((entry) => /trade|order|position/i.test(entry)),
    canWithdraw,
    readOnly: num(result.readOnly) === 1,
    expiresAt: expiry && expiry > 0 ? expiry : null,
  };
}

export function parseWalletBalance(result: Record<string, unknown>): LiveBalance {
  const account = (result.list as Record<string, unknown>[] | undefined)?.[0] ?? {};
  return {
    coin: "USDT",
    totalEquity: num(account.totalEquity),
    availableBalance: num(account.totalAvailableBalance),
    unrealisedPnl: num(account.totalPerpUPL),
  };
}

export function parsePositions(result: Record<string, unknown>): LivePosition[] {
  const list = (result.list as Record<string, unknown>[] | undefined) ?? [];
  return list
    .filter((row) => num(row.size) > 0)
    .map((row) => ({
      symbol: String(row.symbol ?? ""),
      side: String(row.side).toLowerCase() === "sell" ? "short" : "long",
      size: num(row.size),
      entryPrice: num(row.avgPrice),
      markPrice: num(row.markPrice),
      liquidationPrice: optionalNum(row.liqPrice),
      leverage: num(row.leverage),
      margin: num(row.positionIM),
      unrealisedPnl: num(row.unrealisedPnl),
      openedAt: num(row.createdTime) || Date.now(),
    }));
}

export function parseInstrument(row: Record<string, unknown>): Instrument {
  const leverageFilter = (row.leverageFilter ?? {}) as Record<string, unknown>;
  const lotFilter = (row.lotSizeFilter ?? {}) as Record<string, unknown>;
  const priceFilter = (row.priceFilter ?? {}) as Record<string, unknown>;
  return {
    symbol: String(row.symbol ?? ""),
    minLeverage: num(leverageFilter.minLeverage) || 1,
    maxLeverage: num(leverageFilter.maxLeverage) || 1,
    leverageStep: num(leverageFilter.leverageStep) || 0.01,
    minQty: num(lotFilter.minOrderQty),
    qtyStep: num(lotFilter.qtyStep),
    tickSize: num(priceFilter.tickSize),
  };
}

// ---------------------------------------------------------------------------
// Request builders. Each returns a SignedRequest for the relay to forward.
// ---------------------------------------------------------------------------

export const requests = {
  keyInfo: (c: ExchangeCredentials) =>
    buildSignedRequest(c, "GET", "/v5/user/query-api"),

  walletBalance: (c: ExchangeCredentials) =>
    buildSignedRequest(c, "GET", "/v5/account/wallet-balance", {
      accountType: "UNIFIED",
    }),

  positions: (c: ExchangeCredentials, settleCoin = "USDT") =>
    buildSignedRequest(c, "GET", "/v5/position/list", {
      category: "linear",
      settleCoin,
    }),

  instruments: (c: ExchangeCredentials, symbol?: string) =>
    buildSignedRequest(c, "GET", "/v5/market/instruments-info", {
      category: "linear",
      symbol,
    }),

  setLeverage: (c: ExchangeCredentials, symbol: string, leverage: number) =>
    buildSignedRequest(c, "POST", "/v5/position/set-leverage", {
      category: "linear",
      symbol,
      buyLeverage: String(leverage),
      sellLeverage: String(leverage),
    }),

  placeOrder: (c: ExchangeCredentials, params: PlaceOrderParams) =>
    buildSignedRequest(c, "POST", "/v5/order/create", {
      category: "linear",
      symbol: params.symbol,
      side: params.side === "long" ? "Buy" : "Sell",
      orderType: "Market",
      qty: String(params.qty),
      reduceOnly: params.reduceOnly ?? false,
    }),
};

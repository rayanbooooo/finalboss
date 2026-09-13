import { requests } from "@/lib/exchange/bybit";
import { send } from "@/lib/exchange/relay";
import {
  ExchangeError,
  type ExchangeCredentials,
  type Instrument,
  type PlaceOrderParams,
} from "@/lib/exchange/types";

/**
 * Placing and closing orders on a connected account.
 *
 * Kept out of the React layer because almost all of it is venue arithmetic and
 * error translation, both of which are worth testing directly.
 */

/** Bybit: "leverage not modified". It fires whenever the account is already at
 * the requested leverage, which is the common case, and it is a success. */
const LEVERAGE_NOT_MODIFIED = 110043;

/** Decimal places implied by a step like 0.001, including exponent notation
 * (Bybit sends 1e-8 for some symbols). */
export function stepDecimals(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 0;
  const text = step.toString();
  if (text.includes("e-")) return Number(text.split("e-")[1]);
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

/**
 * Rounds an order quantity DOWN to the symbol's step.
 *
 * Down, never nearest: rounding up can ask for more than the margin covers.
 * An unrounded quantity is rejected by the venue outright, which is the most
 * common way a first live order fails.
 *
 * The epsilon is not decoration - 0.3 / 0.1 is 2.9999999999999996 in floating
 * point, so a plain floor would quietly drop a whole step.
 */
export function roundQtyDown(qty: number, step: number): number {
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  if (!Number.isFinite(step) || step <= 0) return qty;
  const steps = Math.floor(qty / step + 1e-9);
  return Number((steps * step).toFixed(stepDecimals(step)));
}

export interface SizedOrder {
  qty: number;
  notional: number;
}

/**
 * Turns margin and leverage into a quantity the venue will accept, or explains
 * why it can't.
 */
export function sizeOrder(
  margin: number,
  leverage: number,
  price: number,
  instrument: Instrument
): SizedOrder {
  if (!(price > 0)) throw new ExchangeError("No price available for this market yet.");
  if (!(margin > 0)) throw new ExchangeError("Enter a margin amount first.");

  const raw = (margin * leverage) / price;
  const qty = roundQtyDown(raw, instrument.qtyStep);

  if (qty <= 0 || qty < instrument.minQty) {
    throw new ExchangeError(
      `Too small for ${instrument.symbol}: the exchange's minimum is ${instrument.minQty} ` +
        `(about ${formatUsd((instrument.minQty * price) / leverage)} of margin at ${leverage}x).`
    );
  }
  return { qty, notional: qty * price };
}

function formatUsd(value: number): string {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Bybit's retCodes are opaque on their own. These are the ones a user can act
 * on; anything else falls through to the venue's own message rather than being
 * flattened into something vague.
 */
export function describeOrderError(code: number, message: string): string {
  switch (code) {
    case 110007:
    case 110045:
    case 110012:
      return "Not enough available balance in your exchange account for this order.";
    case 110017:
      return "That would increase the position rather than close it.";
    case 110013:
      return "This size exceeds the risk limit your account has set for this symbol.";
    case 110021:
    case 110024:
      return (
        "Your Bybit account is in hedge mode, which this terminal doesn't support yet. " +
        "Switch the symbol to One-Way position mode on Bybit and try again."
      );
    case 110009:
      return "Too many open orders on this symbol at the exchange.";
    case 10003:
      return "The exchange rejected this API key. Reconnect it in Settings.";
    case 10004:
      return "The exchange rejected the request signature. Reconnect the key in Settings.";
    case 10005:
      return "This API key doesn't have trade permission. Create one with Trade enabled.";
    case 10006:
    case 10018:
      return "The exchange is rate-limiting this account. Wait a moment and try again.";
    case 10001:
      // A catch-all bucket at the venue, so the message is what distinguishes
      // the cases. Position-mode mismatches land here rather than on a code of
      // their own, and are the one kind a user can actually fix.
      if (/position\s*idx/i.test(message)) {
        return (
          "Your Bybit account is in hedge mode for this symbol, which this " +
          "terminal doesn't support yet. Switch it to One-Way position mode on " +
          "Bybit and try again."
        );
      }
      return `The exchange rejected the order: ${message}`;
    default:
      return message || `The exchange rejected the order (code ${code}).`;
  }
}

async function sendOrThrow(
  request: Awaited<ReturnType<typeof requests.placeOrder>>
): Promise<Record<string, unknown>> {
  try {
    return await send<Record<string, unknown>>(request);
  } catch (error) {
    if (error instanceof ExchangeError && typeof error.code === "number") {
      throw new ExchangeError(describeOrderError(error.code, error.message), error.code);
    }
    throw error;
  }
}

/**
 * Sets leverage, tolerating the "already at that leverage" response.
 *
 * Without that tolerance every order after the first fails, because the account
 * is by then already at the requested leverage and Bybit reports that as an
 * error rather than a no-op.
 */
export async function ensureLeverage(
  credentials: ExchangeCredentials,
  symbol: string,
  leverage: number
): Promise<void> {
  try {
    await send(await requests.setLeverage(credentials, symbol, leverage));
  } catch (error) {
    if (error instanceof ExchangeError && error.code === LEVERAGE_NOT_MODIFIED) return;
    if (error instanceof ExchangeError && typeof error.code === "number") {
      throw new ExchangeError(describeOrderError(error.code, error.message), error.code);
    }
    throw error;
  }
}

/** Opens a position: set leverage, then a market order for the rounded qty. */
export async function openLivePosition(
  credentials: ExchangeCredentials,
  params: PlaceOrderParams & { leverage: number }
): Promise<Record<string, unknown>> {
  await ensureLeverage(credentials, params.symbol, params.leverage);
  return sendOrThrow(
    await requests.placeOrder(credentials, {
      symbol: params.symbol,
      side: params.side,
      qty: params.qty,
    })
  );
}

/**
 * Closes a position with a reduce-only market order on the opposite side.
 *
 * reduceOnly matters: without it a mistimed close that races a fill would open
 * a position the other way instead of flattening this one.
 */
export async function closeLivePosition(
  credentials: ExchangeCredentials,
  symbol: string,
  side: "long" | "short",
  qty: number
): Promise<Record<string, unknown>> {
  return sendOrThrow(
    await requests.placeOrder(credentials, {
      symbol,
      side: side === "long" ? "short" : "long",
      qty,
      reduceOnly: true,
    })
  );
}

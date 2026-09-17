import type { OrderSide } from "@/types/trading";
import type { Candle } from "@/types/market";

const SMA_PERIOD = 20;

/** Rolling simple moving average of closes; `null` while the window hasn't filled yet. */
export function calcSma(candles: Candle[], period = SMA_PERIOD): (number | null)[] {
  const result: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i += 1) {
    sum += candles[i].close;
    if (i >= period) sum -= candles[i - period].close;
    result.push(i >= period - 1 ? sum / period : null);
  }
  return result;
}

/**
 * Simplified approximations of a venue's isolated-margin engine: they ignore
 * funding, fees and partial liquidation. They drive the PREVIEW a trader sees
 * before opening a position. Once a position exists, its numbers are read back
 * from the exchange, because an approximation is not good enough with money on
 * it.
 */
/**
 * The share of the margin that is gone by the time a position is liquidated.
 *
 * The remainder is the buffer a venue keeps back to cover fees and slippage on
 * the forced close, so the account does not go negative. Expressed as a share
 * of MARGIN rather than of notional, which is what makes it the same percentage
 * on every symbol: the distance is 0.9/leverage of the entry price whether that
 * price is BTC's or DOGE's.
 *
 * 0.9 is an approximation of a real venue's isolated-margin engine, where the
 * usable share is one minus a maintenance-margin ratio of roughly half a
 * percent of notional. It replaced 0.65, which was fitted to a demo brief -
 * specific dollar distances at 500x and 1000x - and at the leverage a venue
 * actually permits it put liquidation a third nearer than it really is,
 * understating how much room a position has.
 *
 * This drives the PREVIEW only. An open position shows the venue's own
 * liquidation price, read back from the exchange, because an approximation is
 * not good enough once money is on it.
 *
 * The formulation cannot produce either of the failures earlier versions had:
 * 0.9/leverage is always positive and always below 1/leverage, so liquidation
 * is always between entry and total loss of margin, by construction rather
 * than by clamp.
 */
const LIQUIDATION_MARGIN_FRACTION = 0.9;

/** How far price can move against a position before it's liquidated, as a
 * fraction of the entry price. */
function liquidationMove(leverage: number): number {
  if (!Number.isFinite(leverage) || leverage <= 0) return 0;
  return LIQUIDATION_MARGIN_FRACTION / leverage;
}

export function calcLiquidationPrice(
  entryPrice: number,
  leverage: number,
  side: OrderSide
): number {
  const move = liquidationMove(leverage);
  return side === "long" ? entryPrice * (1 - move) : entryPrice * (1 + move);
}

export function calcPositionSize(
  margin: number,
  leverage: number,
  entryPrice: number
): number {
  if (entryPrice <= 0) return 0;
  return (margin * leverage) / entryPrice;
}

export function calcPnl(
  entryPrice: number,
  markPrice: number,
  size: number,
  side: OrderSide
): number {
  const direction = side === "long" ? 1 : -1;
  return (markPrice - entryPrice) * size * direction;
}

export function calcPnlPercent(pnl: number, margin: number): number {
  if (margin <= 0) return 0;
  return (pnl / margin) * 100;
}

/**
 * Where a new trader starts.
 *
 * Ten, not the maximum. The previous default was 500x, which came from demo
 * mode and exists at no venue this terminal can reach - so every new account
 * opened on a number that would have been rejected. A default is a
 * recommendation whether or not it is meant as one.
 */
export const DEFAULT_LEVERAGE = 10;

/**
 * The highest leverage any symbol here currently offers, for COPY ONLY.
 *
 * 200x is what Aster's own interface allows on BTCUSDT. It is not a bound used
 * in any calculation - the real limit is per symbol and comes from the venue
 * via `leverageBracket` - it exists so a headline and a marketing page cannot
 * drift away from what the product can actually do. The number this replaced
 * was 1000x, which was never available anywhere with real money.
 */
export const VENUE_MAX_LEVERAGE = 200;

export interface LeverageBounds {
  min: number;
  max: number;
}

/**
 * What may be used before the venue's own rules have arrived.
 *
 * `useInstrument` returns null while the fetch is in flight and after a failed
 * one, so something has to stand in. 5x, because this bound is a guess about a
 * symbol whose rules are not yet known and is only in force for the moment
 * before they arrive: every venue permits at least this, so it can never itself
 * be the cause of a rejection, and the range widens to the symbol's real
 * maximum the instant the instrument loads.
 *
 * What used to stand here was the demo range, 500-1000x, offered to a connected
 * account with real money. It exists at no venue, so the first order of a
 * session was rejected after the size had already been chosen.
 */
export const FALLBACK_LEVERAGE_BOUNDS: LeverageBounds = { min: 1, max: 5 };

/** A stored default is always pulled into whatever range currently applies
 * rather than trusted: profiles saved before this carry leverages from demo
 * mode - 500x and above - that no venue will accept. */
export function clampLeverage(
  leverage: number,
  bounds: LeverageBounds = FALLBACK_LEVERAGE_BOUNDS
): number {
  const min = Math.min(bounds.min, bounds.max);
  const max = Math.max(bounds.min, bounds.max);
  if (!Number.isFinite(leverage)) return min;
  return Math.min(max, Math.max(min, Math.round(leverage)));
}

/** Linear across the 0-100 slider. A venue's range reads naturally linear, and
 *  an exponential curve would make round numbers hard to land on. */
export function leverageFromSliderValue(
  sliderValue: number,
  bounds: LeverageBounds = FALLBACK_LEVERAGE_BOUNDS
): number {
  const t = clampSlider(sliderValue) / 100;
  return clampLeverage(bounds.min + t * (bounds.max - bounds.min), bounds);
}

export function sliderValueFromLeverage(
  leverage: number,
  bounds: LeverageBounds = FALLBACK_LEVERAGE_BOUNDS
): number {
  const span = bounds.max - bounds.min;
  if (span <= 0) return 0;
  const t = (clampLeverage(leverage, bounds) - bounds.min) / span;
  return Math.round(clampSlider(t * 100));
}

/** How far price can move against a position before it's liquidated. */
export function liquidationDistancePercent(leverage: number): number {
  return liquidationMove(leverage) * 100;
}

/**
 * Signed move from entry as a percentage of the entry price.
 *
 * Deliberately separate from calcPnlPercent, which is a percentage of the
 * margin. The two differ by exactly the leverage - 0.14% of price is 28% of
 * margin at 200x - and showing either one as a bare "%" next to the other is
 * what makes a position look like it should already have been liquidated.
 */
export function priceMovePercent(entryPrice: number, markPrice: number): number {
  if (entryPrice <= 0) return 0;
  return ((markPrice - entryPrice) / entryPrice) * 100;
}

/**
 * How far a position has travelled from its entry toward its liquidation
 * price, as 0-1. Zero while the trade is in profit, 1 at liquidation. Reads
 * the same at every leverage, which the raw percentages don't.
 */
export function liquidationProgress(
  entryPrice: number,
  markPrice: number,
  liquidationPrice: number,
  side: OrderSide
): number {
  // A venue omits the liquidation price when a position cannot be liquidated,
  // which arrives here as NaN. Without this the meter computes a NaN width.
  if (!Number.isFinite(liquidationPrice) || !Number.isFinite(markPrice)) return 0;
  const span = Math.abs(entryPrice - liquidationPrice);
  if (span <= 0) return 0;
  const adverse = side === "long" ? entryPrice - markPrice : markPrice - entryPrice;
  if (adverse <= 0) return 0;
  return Math.min(1, adverse / span);
}

function clampSlider(value: number): number {
  return Math.min(100, Math.max(0, value));
}

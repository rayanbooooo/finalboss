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
 * All formulas below are simplified, demo-only approximations of a real
 * exchange's isolated-margin engine (they ignore funding rates, fees, and
 * partial liquidation) — good enough to drive a convincing UI, not a real
 * risk engine.
 */
/**
 * The share of the margin that is gone by the time a position is liquidated.
 * The remainder is the buffer a venue keeps back to cover fees and slippage on
 * the forced close, so the account doesn't go negative.
 *
 * Calibrated to the brief: $50 from entry at 1000x and $100 at 500x on BTC.
 * Those are the same fraction of margin - at BTC $77,200 the margin is $77.20
 * at 1000x and $154.40 at 500x, and $50 and $100 are both 64.77% of it - so a
 * single constant satisfies both targets and the dollar distance halves exactly
 * as leverage doubles. Every leverage in between falls out of the same curve
 * rather than an interpolation table.
 *
 * Expressed as a share of *margin* rather than of notional, which is what makes
 * it the same percentage on every symbol: the distance is 0.65/leverage of the
 * entry price whether that price is BTC's or DOGE's.
 *
 * Two earlier versions got this wrong in opposite directions. 0.5% of notional
 * crossed 1/leverage at 200x and put the liquidation price on the wrong side of
 * entry; 0.03% of notional was right in shape but left the distance too far.
 * This formulation cannot produce either failure: 0.65/leverage is always
 * positive and always below 1/leverage, so liquidation is always between entry
 * and total loss of margin, by construction rather than by clamp.
 */
const LIQUIDATION_MARGIN_FRACTION = 0.65;

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

export const MIN_LEVERAGE = 500;
export const MAX_LEVERAGE = 1000;

export interface LeverageBounds {
  min: number;
  max: number;
}

/**
 * The range demo mode offers. Live mode does not use it: a real venue caps
 * leverage per symbol and per risk tier - Bybit allows nothing like 1000x on
 * BTC - so bounds there come from the instrument, and passing these would
 * produce orders the exchange rejects.
 */
export const DEMO_LEVERAGE_BOUNDS: LeverageBounds = {
  min: MIN_LEVERAGE,
  max: MAX_LEVERAGE,
};

/**
 * What a connected account may use before the venue's own rules have arrived.
 *
 * `useInstrument` returns null while the fetch is in flight and after a failed
 * one, and the obvious fallback - the demo bounds - is the wrong answer in the
 * worst way: it offers a live trader 500-1000x, which exists at no venue, so
 * the first order of the session is rejected by Bybit after they have already
 * chosen a size. The demo range must never be reachable with real money.
 *
 * 5x rather than something more generous because this bound is a guess about a
 * symbol whose rules are not known yet, and it is only ever in force for the
 * moment before they arrive. Every Bybit USDT perpetual permits at least this,
 * so it cannot itself be the cause of a rejection, and the range widens to the
 * symbol's real maximum the instant the instrument loads.
 */
export const LIVE_FALLBACK_LEVERAGE_BOUNDS: LeverageBounds = { min: 1, max: 5 };

/** Existing profiles predate the 500x floor, and a profile saved in demo mode
 * carries a leverage no venue will accept, so a stored default is always pulled
 * into whatever range currently applies rather than trusted. */
export function clampLeverage(
  leverage: number,
  bounds: LeverageBounds = DEMO_LEVERAGE_BOUNDS
): number {
  const min = Math.min(bounds.min, bounds.max);
  const max = Math.max(bounds.min, bounds.max);
  if (!Number.isFinite(leverage)) return min;
  return Math.min(max, Math.max(min, Math.round(leverage)));
}

/**
 * Linear across the 0-100 slider. Demo's range is only 2x wide, so an
 * exponential curve would buy nothing and would make round numbers
 * unreachable; a venue range is wider but still reads naturally linear.
 */
export function leverageFromSliderValue(
  sliderValue: number,
  bounds: LeverageBounds = DEMO_LEVERAGE_BOUNDS
): number {
  const t = clampSlider(sliderValue) / 100;
  return clampLeverage(bounds.min + t * (bounds.max - bounds.min), bounds);
}

export function sliderValueFromLeverage(
  leverage: number,
  bounds: LeverageBounds = DEMO_LEVERAGE_BOUNDS
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
 * margin. The two differ by exactly the leverage - 0.028% of price is 28% of
 * margin at 1000x - and showing either one as a bare "%" next to the other is
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

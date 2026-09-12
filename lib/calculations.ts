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

/** Existing profiles predate the 500x floor, so their stored default has to
 * be pulled into range rather than trusted. */
export function clampLeverage(leverage: number): number {
  if (!Number.isFinite(leverage)) return MIN_LEVERAGE;
  return Math.min(MAX_LEVERAGE, Math.max(MIN_LEVERAGE, Math.round(leverage)));
}

/**
 * Linear across the 0-100 slider: the range is only 2x wide, so an
 * exponential curve would buy nothing and would make round numbers
 * unreachable. Each step is 5x, so 500/600/750/1000 all land exactly.
 */
export function leverageFromSliderValue(sliderValue: number): number {
  const t = clampSlider(sliderValue) / 100;
  return clampLeverage(MIN_LEVERAGE + t * (MAX_LEVERAGE - MIN_LEVERAGE));
}

export function sliderValueFromLeverage(leverage: number): number {
  const t = (clampLeverage(leverage) - MIN_LEVERAGE) / (MAX_LEVERAGE - MIN_LEVERAGE);
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

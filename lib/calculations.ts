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
 * Maintenance margin, as a fraction of the position's notional - the standard
 * formulation every real venue uses. Liquidation sits at
 * `initial margin - maintenance margin`, i.e. `1/leverage - this`.
 *
 * 0.03% is calibrated against Aark's live 1000x product: their liquidation
 * price sits 0.070% from entry, which is exactly 0.1% initial margin at 1000x
 * minus this.
 *
 * An earlier version used 0.5%, which crossed 1/leverage at 200x and put the
 * liquidation price on the wrong side of entry - liquidating every position
 * above 200x the instant it opened. The fix then was to express maintenance
 * as a share of margin instead; the real problem was simply that 0.5% is far
 * too large for a venue offering this much leverage. At 0.03% the standard
 * formula holds until 3,333x, well past anything on offer here, and the clamp
 * below makes the degenerate case impossible rather than merely unlikely.
 */
const MAINTENANCE_MARGIN_RATIO = 0.0003;

/** How far price can move against a position before it's liquidated, as a
 * fraction of the entry price. */
function liquidationMove(leverage: number): number {
  if (!Number.isFinite(leverage) || leverage <= 0) return 0;
  return Math.max(0, 1 / leverage - MAINTENANCE_MARGIN_RATIO);
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

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
 * The maintenance buffer is a share of the position's own margin, not a flat
 * fraction of price. A fixed ratio breaks down as leverage rises: at 200x it
 * equals the initial margin ratio, which puts the liquidation price exactly
 * on the entry price and liquidates the position the moment it opens, and
 * past that it crosses to the wrong side of entry entirely. Expressing it as
 * a share keeps liquidation at a consistent 95% loss of margin at every
 * leverage, and leaves the common cases (10x and below) unchanged.
 */
const MAINTENANCE_MARGIN_SHARE = 0.05;

export function calcLiquidationPrice(
  entryPrice: number,
  leverage: number,
  side: OrderSide
): number {
  // Distance from entry to liquidation, as a fraction of price.
  const move = (1 / leverage) * (1 - MAINTENANCE_MARGIN_SHARE);
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
 * Maps a linear 0-100 slider input to a 1x-1000x leverage value along an
 * exponential curve, so low-leverage values aren't crushed into one end of
 * the track.
 */
export function leverageFromSliderValue(sliderValue: number): number {
  const t = clampSlider(sliderValue) / 100;
  const leverage = Math.pow(1000, t);
  return Math.max(1, Math.round(leverage));
}

export function sliderValueFromLeverage(leverage: number): number {
  const safeLeverage = Math.max(1, leverage);
  const t = Math.log(safeLeverage) / Math.log(1000);
  return Math.round(clampSlider(t * 100));
}

function clampSlider(value: number): number {
  return Math.min(100, Math.max(0, value));
}

import type { OrderSide } from "@/types/trading";

/**
 * All formulas below are simplified, demo-only approximations of a real
 * exchange's isolated-margin engine (they ignore funding rates, fees, and
 * partial liquidation) — good enough to drive a convincing UI, not a real
 * risk engine.
 */
const MAINTENANCE_MARGIN_RATIO = 0.005;

export function calcLiquidationPrice(
  entryPrice: number,
  leverage: number,
  side: OrderSide
): number {
  const marginRatio = 1 / leverage;
  if (side === "long") {
    return entryPrice * (1 - marginRatio + MAINTENANCE_MARGIN_RATIO);
  }
  return entryPrice * (1 + marginRatio - MAINTENANCE_MARGIN_RATIO);
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

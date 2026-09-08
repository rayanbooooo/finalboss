"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { buttonVariants } from "@/components/ui/Button";
import { LeverageSlider } from "@/components/terminal/LeverageSlider";
import { useGlobalMarketFeed } from "@/contexts/MarketFeedContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { calcLiquidationPrice } from "@/lib/calculations";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { OrderSide } from "@/types/trading";
import { cn } from "@/lib/utils";

const EASE = [0.21, 0.47, 0.32, 0.98] as const;
const PREVIEW_MARGIN = 1000;

export function Hero() {
  const { activeMarket: market } = useGlobalMarketFeed();
  const { isOnboarded } = useOnboarding();
  const positive = market.change24hPct >= 0;
  const launchHref = isOnboarded ? "/terminal" : "/signup";

  const [side, setSide] = useState<OrderSide>("long");
  const [leverage, setLeverage] = useState(20);

  // Notional USD exposure (margin x leverage) - not calcPositionSize, which
  // returns the position size in units of the underlying asset (BTC).
  const positionNotional = PREVIEW_MARGIN * leverage;
  const liquidationPrice = calcLiquidationPrice(market.price, leverage, side);
  const distanceToLiq =
    market.price > 0 ? (Math.abs(liquidationPrice - market.price) / market.price) * 100 : 0;

  return (
    <section className="relative overflow-hidden px-4 pb-24 pt-16 sm:px-6 sm:pt-24 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute -left-32 -top-24 h-[420px] w-[420px] animate-drift-1 rounded-full bg-violet-500/15 blur-[100px] motion-reduce:animate-none" />
        <div className="absolute -right-20 top-0 h-[400px] w-[400px] animate-drift-2 rounded-full bg-sky-400/15 blur-[100px] motion-reduce:animate-none" />
        <div className="absolute left-1/3 top-[380px] h-[420px] w-[420px] animate-drift-3 rounded-full bg-emerald-400/15 blur-[100px] motion-reduce:animate-none" />
      </div>

      <div className="relative mx-auto grid max-w-7xl gap-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[11px] tracking-wide text-white/50">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            ZERO GAS &middot; INSTANT SETTLEMENT
          </div>

          <h1 className="mt-6 font-display text-[2.75rem] font-semibold leading-[1.02] tracking-tight text-white sm:text-6xl lg:text-[4rem]">
            Perpetuals,
            <br />
            <span className="bg-gradient-to-r from-[#E8C87A] via-[#C9A65B] to-[#E8C87A] bg-clip-text text-transparent">
              up to 1000x
            </span>{" "}
            leverage.
          </h1>

          <p className="mt-6 max-w-lg text-base leading-relaxed text-white/55 sm:text-lg">
            Off-chain matching infrastructure inspired by Orderly Network and
            Aark. Deep orderbook liquidity, instant settlement, real market
            data — built for the highest-conviction traders.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href={launchHref}
              className={cn(buttonVariants("primary", "lg"), "w-full sm:w-auto")}
            >
              Launch App <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/signup"
              className={cn(buttonVariants("outline", "lg"), "w-full sm:w-auto")}
            >
              Sign Up
            </Link>
          </div>

          <p className="mt-6 max-w-md text-xs leading-relaxed text-white/35">
            <span className="text-amber-400">&#9888;</span> High leverage
            magnifies losses as fast as gains. Trade responsibly.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
          className="relative flex flex-col gap-5 lg:block lg:min-h-[500px]"
        >
          <div
            className={cn(
              "w-full rounded-[22px] border border-white/10 bg-base-900/70 shadow-2xl backdrop-blur-xl",
              "lg:absolute lg:right-0 lg:top-4 lg:w-[360px]"
            )}
          >
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
              <span className="flex items-center gap-2 text-sm font-semibold text-white">
                <span className="h-[7px] w-[7px] animate-pulse-glow rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] motion-reduce:animate-none" />
                Open a position
              </span>
              <span className="rounded-md border border-white/10 px-2 py-0.5 font-mono text-[10px] tracking-wide text-white/40">
                PREVIEW
              </span>
            </div>

            <div className="p-5">
              <div className="mb-4 flex items-baseline justify-between">
                <span className="text-base font-semibold text-white">{market.symbol}</span>
                <div className="text-right">
                  <div className="font-mono text-sm font-medium text-white">
                    {formatCurrency(market.price)}
                  </div>
                  <div
                    className={cn(
                      "font-mono text-xs",
                      positive ? "text-emerald-400" : "text-rose-400"
                    )}
                  >
                    {formatPercent(market.change24hPct)}
                  </div>
                </div>
              </div>

              <div className="mb-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-pressed={side === "long"}
                  onClick={() => setSide("long")}
                  className={cn(
                    "min-h-11 rounded-xl border text-sm font-bold transition-colors",
                    side === "long"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                      : "border-white/10 text-white/50"
                  )}
                >
                  Long
                </button>
                <button
                  type="button"
                  aria-pressed={side === "short"}
                  onClick={() => setSide("short")}
                  className={cn(
                    "min-h-11 rounded-xl border text-sm font-bold transition-colors",
                    side === "short"
                      ? "border-rose-500/40 bg-rose-500/10 text-rose-400"
                      : "border-white/10 text-white/50"
                  )}
                >
                  Short
                </button>
              </div>

              <LeverageSlider leverage={leverage} onChange={setLeverage} />

              <div className="mt-5 flex flex-col gap-2.5 border-y border-white/5 py-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/45">Margin</span>
                  <span className="font-mono tabular-nums text-white/85">
                    {formatCurrency(PREVIEW_MARGIN)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/45">Position size</span>
                  <span className="font-mono tabular-nums text-white/85">
                    {formatCurrency(positionNotional)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/45">Liquidation price</span>
                  <span className="font-mono tabular-nums text-rose-400">
                    {formatCurrency(liquidationPrice)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/45">Distance to liq.</span>
                  <span className="font-mono tabular-nums text-rose-400">
                    {distanceToLiq.toFixed(2)}%
                  </span>
                </div>
              </div>

              <Link
                href={launchHref}
                className={cn(buttonVariants("primary", "lg"), "mt-5 w-full")}
              >
                Launch App <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="mt-3 text-center text-[11px] leading-relaxed text-white/30">
                Illustrative preview, priced off the real live feed above —
                no funds are moved on this page.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

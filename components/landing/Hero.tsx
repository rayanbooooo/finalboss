"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { buttonVariants } from "@/components/ui/Button";
import { LeverageSlider } from "@/components/terminal/LeverageSlider";
import { useGlobalMarketFeed } from "@/contexts/MarketFeedContext";
import { calcLiquidationPrice, calcPnl, calcPositionSize } from "@/lib/calculations";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { OrderSide } from "@/types/trading";
import { cn } from "@/lib/utils";

const EASE = [0.21, 0.47, 0.32, 0.98] as const;
const PREVIEW_MARGIN = 1000;
const CARD_LEVERAGE = 20;
const CARD_ENTRY_DISCOUNT = 0.973;

export function Hero() {
  const market = useGlobalMarketFeed();
  const positive = market.change24hPct >= 0;

  const [side, setSide] = useState<OrderSide>("long");
  const [leverage, setLeverage] = useState(20);
  // Frozen at first paint so the floating card doesn't jump around as the
  // live price ticks - only the "mark" side of it stays live.
  const [cardEntry] = useState(() => market.price * CARD_ENTRY_DISCOUNT);

  const cardSize = calcPositionSize(PREVIEW_MARGIN, CARD_LEVERAGE, cardEntry);
  const cardPnl = calcPnl(cardEntry, market.price, cardSize, "long");

  // Notional USD exposure (margin x leverage) - not calcPositionSize, which
  // returns the position size in units of the underlying asset (BTC).
  const positionNotional = PREVIEW_MARGIN * leverage;
  const liquidationPrice = calcLiquidationPrice(market.price, leverage, side);
  const distanceToLiq =
    market.price > 0 ? (Math.abs(liquidationPrice - market.price) / market.price) * 100 : 0;

  return (
    <section className="relative overflow-hidden px-4 pb-24 pt-16 sm:px-6 sm:pt-24 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute -left-40 -top-56 h-[620px] w-[620px] animate-drift-1 rounded-full bg-violet-500/30 blur-[90px] motion-reduce:animate-none" />
        <div className="absolute -right-44 -top-36 h-[560px] w-[560px] animate-drift-2 rounded-full bg-sky-400/25 blur-[90px] motion-reduce:animate-none" />
        <div className="absolute left-[28%] top-32 h-[520px] w-[520px] animate-drift-3 rounded-full bg-emerald-400/20 blur-[90px] motion-reduce:animate-none" />
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
            <span className="bg-gradient-to-r from-violet-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
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
              href="/terminal"
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
              "w-full rounded-[22px] p-5 shadow-[0_30px_70px_-20px_rgba(139,92,246,0.35)]",
              "bg-gradient-to-br from-violet-500 via-sky-400 to-emerald-400 text-base-950/85",
              "lg:absolute lg:left-[4%] lg:top-1 lg:w-[300px] lg:-rotate-6"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-black/15 px-2.5 py-1 font-mono text-[11px] font-medium tracking-wide">
                LONG &middot; {market.symbol}
              </span>
              <span className="font-mono text-base font-bold">{CARD_LEVERAGE}x</span>
            </div>
            <div className="mt-5">
              <div className="font-mono text-2xl font-bold tabular-nums">
                {formatCurrency(cardPnl)}
              </div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider opacity-70">
                Unrealized P&amp;L
              </div>
            </div>
            <div className="mt-5 flex justify-between font-mono text-[11px] font-medium opacity-80">
              <span>Entry {formatCurrency(cardEntry)}</span>
              <span>Mark {formatCurrency(market.price)}</span>
            </div>
          </div>

          <div
            className={cn(
              "w-full rounded-[22px] border border-white/10 bg-base-900/70 shadow-2xl backdrop-blur-xl",
              "lg:absolute lg:right-0 lg:top-28 lg:w-[360px]"
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
                href="/terminal"
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

"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { buttonVariants } from "@/components/ui/Button";
import { CandlestickChart } from "@/components/terminal/CandlestickChart";
import { useGlobalMarketFeed } from "@/contexts/MarketFeedContext";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

const EASE = [0.21, 0.47, 0.32, 0.98] as const;

export function Hero() {
  const market = useGlobalMarketFeed();
  const positive = market.change24hPct >= 0;

  return (
    <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:px-8">
      <div
        className="pointer-events-none absolute inset-0 bg-radial-glow opacity-60"
        aria-hidden="true"
      />

      <div className="relative mx-auto grid max-w-7xl gap-14 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[11px] tracking-wide text-white/50">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            ZERO GAS &middot; INSTANT SETTLEMENT
          </div>

          <h1 className="mt-6 text-[2.75rem] font-semibold leading-[1.02] tracking-tight text-white sm:text-6xl lg:text-[4rem]">
            Perpetuals,
            <br />
            <span className="text-violet-400">up to 1000x</span> leverage.
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
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
          className="overflow-hidden rounded-2xl border border-white/10 bg-base-900/70 shadow-2xl"
        >
          <div className="flex items-center gap-1.5 border-b border-white/5 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
            <span className="ml-3 font-mono text-[11px] text-white/35">
              finalboss.trade/terminal
            </span>
          </div>

          <div className="flex items-center justify-between px-4 pt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">{market.symbol}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 font-mono text-[10px]",
                  market.isLive
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-violet-500/15 text-violet-300"
                )}
              >
                {market.isLive ? "LIVE" : "SIMULATED"}
              </span>
            </div>
            <div className="text-right">
              <div className="font-mono text-lg font-bold text-white">
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

          <div className="px-2 pb-3 pt-2">
            <CandlestickChart
              candles={market.candles}
              currentPrice={market.price}
              heightClassName="h-[220px]"
              interactive={false}
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

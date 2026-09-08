"use client";

import Link from "next/link";
import { useGlobalMarketFeed } from "@/contexts/MarketFeedContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { CryptoIcon } from "@/components/ui/CryptoIcon";
import { Sparkline } from "@/components/ui/Sparkline";
import { Reveal } from "@/components/ui/Reveal";
import { MARKETS } from "@/lib/markets";
import { formatPercent, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

const SPARK_WINDOW = 30;

export function MarketsSection() {
  const { markets } = useGlobalMarketFeed();
  const { isOnboarded } = useOnboarding();
  const href = isOnboarded ? "/terminal" : "/signup";

  return (
    <section className="relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute -left-24 top-10 h-[420px] w-[420px] animate-drift-2 rounded-full bg-emerald-400/15 blur-[100px] motion-reduce:animate-none" />
        <div className="absolute -right-16 bottom-0 h-[380px] w-[380px] animate-drift-3 rounded-full bg-violet-500/15 blur-[100px] motion-reduce:animate-none" />
      </div>

      <div className="mx-auto max-w-7xl">
        <Reveal className="max-w-xl">
          <span className="font-mono text-xs tracking-wide text-violet-400/70">
            [ LIVE MARKETS ]
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Every market, live
          </h2>
          <p className="mt-4 text-white/50">
            Real-time pricing across five perpetual markets — the same feed
            that drives the terminal, not a canned demo.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {MARKETS.map((config, index) => {
            const snapshot = markets[config.id];
            const positive = snapshot.change24hPct >= 0;
            const sparkValues = snapshot.candles.slice(-SPARK_WINDOW).map((c) => c.close);

            return (
              <Reveal key={config.id} delay={index * 0.05}>
                <Link
                  href={href}
                  className="group flex flex-col gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 transition-colors hover:border-violet-500/30 hover:bg-white/[0.04]"
                >
                  <div className="flex items-center gap-2.5">
                    <CryptoIcon symbol={config.icon} className="h-8 w-8" />
                    <span className="flex flex-col">
                      <span className="text-sm font-semibold text-white">{config.symbol}</span>
                      <span className="flex items-center gap-1 text-[11px] text-white/40">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            snapshot.isLive ? "bg-emerald-400" : "bg-violet-400"
                          )}
                        />
                        {snapshot.isLive ? "Live" : "Simulated"}
                      </span>
                    </span>
                  </div>

                  <Sparkline
                    values={sparkValues}
                    className={cn("h-10 w-full", positive ? "text-emerald-400" : "text-rose-400")}
                  />

                  <div>
                    <div className="font-mono text-lg font-semibold text-white">
                      {formatPrice(snapshot.price)}
                    </div>
                    <div
                      className={cn(
                        "font-mono text-xs",
                        positive ? "text-emerald-400" : "text-rose-400"
                      )}
                    >
                      {formatPercent(snapshot.change24hPct)} (24h)
                    </div>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

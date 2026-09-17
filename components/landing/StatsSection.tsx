"use client";

import { StatsCounter } from "@/components/landing/StatsCounter";
import { Reveal } from "@/components/ui/Reveal";
import { useGlobalMarketFeed } from "@/contexts/MarketFeedContext";
import { MARKETS } from "@/lib/markets";
import { VENUE_MAX_LEVERAGE } from "@/lib/calculations";

/**
 * Three figures about the markets this site trades.
 *
 * Two of them are measured, from the same Bybit ticker feed the rest of the
 * page runs on - no extra request. They replaced a "$4.82B total volume /
 * 128,400 active traders / $3.95M daily liquidations" block that was invented
 * whole and then animated upward to look live. None of those three numbers
 * described anything; FinalBoss has never traded a dollar of volume.
 *
 * They are summed only over markets whose feed is actually live. A market on
 * the simulator contributes nothing rather than contributing a made-up figure,
 * and if none are live the tiles say so instead of showing a total.
 */
export function StatsSection() {
  const { markets } = useGlobalMarketFeed();

  const live = MARKETS.map((m) => markets[m.id]).filter((snapshot) => snapshot.isLive);
  const sum = (pick: (snapshot: (typeof live)[number]) => number) =>
    live.length === 0 ? null : live.reduce((total, snapshot) => total + pick(snapshot), 0);

  const turnover = sum((snapshot) => snapshot.turnover24h);
  const openInterest = sum((snapshot) => snapshot.openInterestUsd);
  const covered = live.length === MARKETS.length ? "all five markets" : `${live.length} of ${MARKETS.length} markets`;

  return (
    <section className="relative overflow-hidden px-4 py-16 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute left-1/2 top-1/2 h-[380px] w-[640px] -translate-x-1/2 -translate-y-1/2 animate-drift-1 rounded-full bg-violet-500/10 blur-[110px] motion-reduce:animate-none" />
      </div>
      <Reveal className="mx-auto max-w-5xl border-y border-white/[0.07] py-10">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:divide-x sm:divide-white/[0.07]">
          <div className="sm:pr-8">
            <StatsCounter
              label="24h Volume"
              value={turnover}
              prefix="$"
              note={turnover === null ? "Feed unavailable" : `Traded on Bybit across ${covered}`}
            />
          </div>
          <div className="sm:px-8">
            <StatsCounter
              label="Open Interest"
              value={openInterest}
              prefix="$"
              note={
                openInterest === null
                  ? "Feed unavailable"
                  : "Positions currently open on those contracts"
              }
            />
          </div>
          <div className="sm:pl-8">
            {/* Not a market measurement - a fact about this product, and the
                reason anyone is here. Kept in the same row because a third
                empty tile would be worse than an honest one. */}
            <div>
              <div className="font-mono text-xs uppercase tracking-wide text-white/40">
                Max Leverage
              </div>
              <div className="mt-2 font-mono text-3xl font-semibold tabular-nums text-white sm:text-4xl">
                {VENUE_MAX_LEVERAGE}x
              </div>
              <div className="mt-1.5 text-xs text-white/35">Where the exchange allows it</div>
            </div>
          </div>
        </div>

        <p className="mt-8 text-xs text-white/30">
          Live from Bybit &middot; BTC, ETH, SOL, XRP and DOGE perpetuals. These are the venue&apos;s
          figures, not FinalBoss&apos;s &mdash; this site has no volume of its own to report.
        </p>
      </Reveal>
    </section>
  );
}

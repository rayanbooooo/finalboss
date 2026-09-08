"use client";

import { useGlobalMarketFeed } from "@/contexts/MarketFeedContext";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export function LiveTicker() {
  const market = useGlobalMarketFeed();

  if (!market.price) return null;

  const positive = market.change24hPct >= 0;

  return (
    <div className="hidden items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 lg:flex">
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          market.isLive ? "animate-pulse-glow bg-emerald-400" : "bg-white/25"
        )}
      />
      <span className="font-mono text-[11px] font-medium text-white/45">BTC</span>
      <span className="font-mono text-xs font-semibold tabular-nums text-white">
        {formatCurrency(market.price)}
      </span>
      <span
        className={cn(
          "font-mono text-[11px] tabular-nums",
          positive ? "text-emerald-400" : "text-rose-400"
        )}
      >
        {formatPercent(market.change24hPct, 1)}
      </span>
    </div>
  );
}

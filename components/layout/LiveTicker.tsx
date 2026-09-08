"use client";

import { CryptoIcon } from "@/components/ui/CryptoIcon";
import { useGlobalMarketFeed } from "@/contexts/MarketFeedContext";
import { MARKETS } from "@/lib/markets";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export function LiveTicker() {
  const { activeMarket, activeMarketId } = useGlobalMarketFeed();
  const config = MARKETS.find((m) => m.id === activeMarketId) ?? MARKETS[0];

  if (!activeMarket.price) return null;

  const positive = activeMarket.change24hPct >= 0;

  return (
    <div className="hidden items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 lg:flex">
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          activeMarket.isLive ? "animate-pulse-glow bg-emerald-400" : "bg-white/25"
        )}
      />
      <CryptoIcon symbol={config.icon} className="h-3.5 w-3.5" />
      <span className="font-mono text-xs font-semibold tabular-nums text-white">
        {formatCurrency(activeMarket.price)}
      </span>
      <span
        className={cn(
          "font-mono text-[11px] tabular-nums",
          positive ? "text-emerald-400" : "text-rose-400"
        )}
      >
        {formatPercent(activeMarket.change24hPct, 1)}
      </span>
    </div>
  );
}

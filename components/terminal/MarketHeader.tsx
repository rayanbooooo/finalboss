"use client";

import { useTerminal } from "@/contexts/TerminalContext";
import { formatCompactNumber, formatCurrency, formatPercent } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export function MarketHeader() {
  const { market } = useTerminal();
  const positive = market.change24hPct >= 0;

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-white/5 px-4 py-4 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-yellow-500 text-sm font-bold text-white">
          ₿
        </span>
        <div>
          <div className="text-sm font-semibold text-white">{market.symbol}</div>
          <Badge variant={market.isLive ? "emerald" : "violet"} className="mt-0.5">
            <span
              className={cn(
                "h-1.5 w-1.5 animate-pulse-glow rounded-full",
                market.isLive ? "bg-emerald-400" : "bg-violet-400"
              )}
            />
            {market.isLive ? "LIVE" : "SIMULATED"}
          </Badge>
        </div>
      </div>

      <div>
        <div className="font-mono text-2xl font-bold text-white">
          {formatCurrency(market.price)}
        </div>
        <div
          className={cn(
            "text-sm font-medium",
            positive ? "text-emerald-400" : "text-rose-400"
          )}
        >
          {formatPercent(market.change24hPct)} (24h)
        </div>
      </div>

      <div className="hidden gap-8 text-sm sm:flex">
        <Stat label="24h High" value={formatCurrency(market.high24h)} />
        <Stat label="24h Low" value={formatCurrency(market.low24h)} />
        <Stat label="24h Volume" value={`$${formatCompactNumber(market.volume24h)}`} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-white/40">{label}</div>
      <div className="mt-0.5 font-mono text-white/80">{value}</div>
    </div>
  );
}

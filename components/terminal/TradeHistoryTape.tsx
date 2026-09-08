"use client";

import { useTerminal } from "@/contexts/TerminalContext";
import { formatTimestamp, priceDecimals } from "@/lib/format";
import { cn } from "@/lib/utils";

export function TradeHistoryTape() {
  const { market } = useTerminal();

  return (
    <div className="flex flex-col text-xs">
      <div className="grid grid-cols-3 gap-x-2 border-b border-white/5 px-3 py-2 text-white/40">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Time</span>
      </div>
      <div className="max-h-[280px] overflow-y-auto">
        {market.trades.map((trade) => (
          <div key={trade.id} className="grid grid-cols-3 gap-x-2 px-3 py-1 font-mono">
            <span className={cn(trade.side === "buy" ? "text-emerald-400" : "text-rose-400")}>
              {trade.price.toFixed(priceDecimals(trade.price))}
            </span>
            <span className="text-right text-white/70">{trade.size.toFixed(3)}</span>
            <span className="text-right text-white/40">{formatTimestamp(trade.time)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

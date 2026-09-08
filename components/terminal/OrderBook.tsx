"use client";

import { useTerminal } from "@/contexts/TerminalContext";
import { formatCurrency, priceDecimals } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrderBookLevel } from "@/types/market";

export function OrderBook() {
  const { market } = useTerminal();
  const { bids, asks } = market.orderbook;
  const maxSize = Math.max(...bids.map((b) => b.size), ...asks.map((a) => a.size), 0.01);
  const spread = asks[0] && bids[0] ? asks[0].price - bids[0].price : 0;

  return (
    <div className="flex flex-col text-xs">
      <div className="px-3 pt-3 text-xs font-medium text-white/40">Order Book</div>
      <div className="grid grid-cols-2 gap-x-2 border-b border-white/5 px-3 py-2 text-white/40">
        <span>Price</span>
        <span className="text-right">Size</span>
      </div>

      <div className="flex flex-col-reverse">
        {asks
          .slice(0, 8)
          .reverse()
          .map((level) => (
            <Level key={`ask-${level.price.toFixed(2)}`} level={level} maxSize={maxSize} side="ask" />
          ))}
      </div>

      <div className="border-y border-white/5 px-3 py-2 font-mono text-[11px] text-white/40">
        Spread: {formatCurrency(spread)}
      </div>

      <div className="flex flex-col">
        {bids.slice(0, 8).map((level) => (
          <Level key={`bid-${level.price.toFixed(2)}`} level={level} maxSize={maxSize} side="bid" />
        ))}
      </div>
    </div>
  );
}

function Level({
  level,
  maxSize,
  side,
}: {
  level: OrderBookLevel;
  maxSize: number;
  side: "bid" | "ask";
}) {
  const width = Math.min(100, (level.size / maxSize) * 100);
  const barColor = side === "bid" ? "bg-emerald-500/15" : "bg-rose-500/15";
  const textColor = side === "bid" ? "text-emerald-400" : "text-rose-400";

  return (
    <div className="relative grid grid-cols-2 gap-x-2 px-3 py-1 font-mono">
      <div className={cn("absolute inset-y-0 right-0", barColor)} style={{ width: `${width}%` }} />
      <span className={cn("relative", textColor)}>
        {level.price.toFixed(priceDecimals(level.price))}
      </span>
      <span className="relative text-right text-white/70">{level.size.toFixed(3)}</span>
    </div>
  );
}

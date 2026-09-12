"use client";

import { useTerminal } from "@/contexts/TerminalContext";
import { formatCurrency, priceDecimals } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrderBookLevel } from "@/types/market";

/** Running cumulative size, assuming `levels` is ordered best-price-first. */
function withCumulativeTotal(levels: OrderBookLevel[]): Array<OrderBookLevel & { total: number }> {
  let running = 0;
  return levels.map((level) => {
    running += level.size;
    return { ...level, total: running };
  });
}

export function OrderBook() {
  const { market } = useTerminal();
  const positive = market.change24hPct >= 0;
  const { bids, asks } = market.orderbook;
  const bidsWithTotal = withCumulativeTotal(bids.slice(0, 8));
  const asksWithTotal = withCumulativeTotal(asks.slice(0, 8));
  const maxTotal = Math.max(
    bidsWithTotal[bidsWithTotal.length - 1]?.total ?? 0,
    asksWithTotal[asksWithTotal.length - 1]?.total ?? 0,
    0.01
  );
  const spread = asks[0] && bids[0] ? asks[0].price - bids[0].price : 0;
  // Real candle history arrives over plain HTTPS while the book needs the
  // websocket, so the two can land apart - and an empty grid with a price
  // floating in the middle of it reads as a broken market rather than as a
  // book that hasn't arrived yet.
  const awaitingBook = bids.length === 0 && asks.length === 0;

  return (
    <div className="flex flex-col text-xs">
      <div className="px-3 pt-3 text-xs font-medium text-white/40">Order Book</div>
      <div className="grid grid-cols-3 gap-x-2 border-b border-white/5 px-3 py-2 text-white/40">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
      </div>

      {awaitingBook && (
        <div className="px-3 py-6 text-center text-white/40">
          {market.isLive ? "Waiting for the order book…" : "Order book unavailable — feed offline."}
        </div>
      )}

      <div className="flex flex-col-reverse">
        {asksWithTotal
          .slice()
          .reverse()
          .map((level) => (
            <Level
              key={`ask-${level.price.toFixed(2)}`}
              level={level}
              maxTotal={maxTotal}
              side="ask"
            />
          ))}
      </div>

      <div className="border-y border-white/5 px-3 py-2">
        <div
          className={cn(
            "text-center font-mono text-sm font-semibold",
            positive ? "text-emerald-400" : "text-rose-400"
          )}
        >
          {formatCurrency(market.price)}
        </div>
        <div className="mt-0.5 text-center font-mono text-[10px] text-white/40">
          Spread: {formatCurrency(spread)}
        </div>
      </div>

      <div className="flex flex-col">
        {bidsWithTotal.map((level) => (
          <Level key={`bid-${level.price.toFixed(2)}`} level={level} maxTotal={maxTotal} side="bid" />
        ))}
      </div>
    </div>
  );
}

function Level({
  level,
  maxTotal,
  side,
}: {
  level: OrderBookLevel & { total: number };
  maxTotal: number;
  side: "bid" | "ask";
}) {
  const width = Math.min(100, (level.total / maxTotal) * 100);
  const barColor = side === "bid" ? "bg-emerald-500/15" : "bg-rose-500/15";
  const textColor = side === "bid" ? "text-emerald-400" : "text-rose-400";

  return (
    <div className="relative grid grid-cols-3 gap-x-2 px-3 py-1 font-mono">
      <div className={cn("absolute inset-y-0 right-0", barColor)} style={{ width: `${width}%` }} />
      <span className={cn("relative", textColor)}>
        {level.price.toFixed(priceDecimals(level.price))}
      </span>
      <span className="relative text-right text-white/70">{level.size.toFixed(3)}</span>
      <span className="relative text-right text-white/40">{level.total.toFixed(3)}</span>
    </div>
  );
}

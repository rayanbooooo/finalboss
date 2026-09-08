"use client";

import { useTerminal } from "@/contexts/TerminalContext";
import { formatCurrency, formatPercent, formatPrice } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CryptoIcon } from "@/components/ui/CryptoIcon";
import { getMarketConfig } from "@/lib/markets";
import { cn } from "@/lib/utils";

export function OpenPositionsTable() {
  const { openPositions, closePosition } = useTerminal();

  if (openPositions.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-sm text-white/40 sm:px-6">
        No open positions yet. Place a trade to get started.
      </div>
    );
  }

  return (
    <table className="w-full min-w-[720px] text-left text-sm">
      <thead>
        <tr className="border-b border-white/5 text-xs text-white/40">
          <th className="px-4 py-3 font-medium sm:px-6">Market</th>
          <th className="px-4 py-3 font-medium">Side</th>
          <th className="px-4 py-3 font-medium">Size</th>
          <th className="px-4 py-3 font-medium">Entry Price</th>
          <th className="px-4 py-3 font-medium">Mark Price</th>
          <th className="px-4 py-3 font-medium">Liq. Price</th>
          <th className="px-4 py-3 font-medium">PnL</th>
          <th className="px-4 py-3 font-medium" />
        </tr>
      </thead>
      <tbody>
        {openPositions.map((position) => {
          const profit = position.pnl >= 0;
          const config = getMarketConfig(position.marketId);
          return (
            <tr key={position.id} className="border-b border-white/5 odd:bg-white/[0.02]">
              <td className="px-4 py-3 sm:px-6">
                <span className="flex items-center gap-2">
                  <CryptoIcon symbol={config.icon} className="h-5 w-5" />
                  <span className="font-medium text-white/85">{position.symbol}</span>
                </span>
              </td>
              <td className="px-4 py-3">
                <Badge variant={position.side === "long" ? "emerald" : "rose"}>
                  {position.side === "long" ? "Long" : "Short"} {position.leverage}x
                </Badge>
              </td>
              <td className="px-4 py-3 font-mono text-white/80">{position.size.toFixed(4)}</td>
              <td className="px-4 py-3 font-mono text-white/80">
                {formatPrice(position.entryPrice)}
              </td>
              <td className="px-4 py-3 font-mono text-white/80">
                {formatPrice(position.markPrice)}
              </td>
              <td className="px-4 py-3 font-mono text-rose-400">
                {formatPrice(position.liquidationPrice)}
              </td>
              <td className={cn("px-4 py-3 font-mono", profit ? "text-emerald-400" : "text-rose-400")}>
                {formatCurrency(position.pnl)} ({formatPercent(position.pnlPercent)})
              </td>
              <td className="px-4 py-3">
                <Button variant="outline" size="sm" onClick={() => closePosition(position.id)}>
                  Close
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

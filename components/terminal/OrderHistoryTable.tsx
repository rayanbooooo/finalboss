"use client";

import { useTerminal } from "@/contexts/TerminalContext";
import { formatCurrency, formatTimestamp } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export function OrderHistoryTable() {
  const { history } = useTerminal();

  if (history.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-sm text-white/40 sm:px-6">
        No closed positions yet.
      </div>
    );
  }

  return (
    <table className="w-full min-w-[720px] text-left text-sm">
      <thead>
        <tr className="border-b border-white/5 text-xs text-white/40">
          <th className="px-4 py-3 font-medium sm:px-6">Side</th>
          <th className="px-4 py-3 font-medium">Size</th>
          <th className="px-4 py-3 font-medium">Entry Price</th>
          <th className="px-4 py-3 font-medium">Close Price</th>
          <th className="px-4 py-3 font-medium">Status</th>
          <th className="px-4 py-3 font-medium">PnL</th>
          <th className="px-4 py-3 font-medium">Closed</th>
        </tr>
      </thead>
      <tbody>
        {history.map((position) => {
          const pnl = position.realizedPnl ?? 0;
          const profit = pnl >= 0;
          return (
            <tr key={position.id} className="border-b border-white/5">
              <td className="px-4 py-3 sm:px-6">
                <Badge variant={position.side === "long" ? "emerald" : "rose"}>
                  {position.side === "long" ? "Long" : "Short"} {position.leverage}x
                </Badge>
              </td>
              <td className="px-4 py-3 font-mono text-white/80">{position.size.toFixed(4)}</td>
              <td className="px-4 py-3 font-mono text-white/80">
                {formatCurrency(position.entryPrice)}
              </td>
              <td className="px-4 py-3 font-mono text-white/80">
                {position.closePrice ? formatCurrency(position.closePrice) : "—"}
              </td>
              <td className="px-4 py-3">
                <Badge variant={position.status === "liquidated" ? "rose" : "neutral"}>
                  {position.status === "liquidated" ? "Liquidated" : "Closed"}
                </Badge>
              </td>
              <td className={cn("px-4 py-3 font-mono", profit ? "text-emerald-400" : "text-rose-400")}>
                {formatCurrency(pnl)}
              </td>
              <td className="px-4 py-3 text-white/50">
                {position.closedAt ? formatTimestamp(position.closedAt) : "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

"use client";

import { useState } from "react";
import { Receipt } from "lucide-react";
import { useTerminal } from "@/contexts/TerminalContext";
import { formatCurrency, formatPrice, formatTimestamp } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { CryptoIcon } from "@/components/ui/CryptoIcon";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { getMarketConfig } from "@/lib/markets";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

export function OrderHistoryTable() {
  const { history } = useTerminal();
  const [page, setPage] = useState(1);

  const pageCount = Math.max(1, Math.ceil(history.length / PAGE_SIZE));
  // Closing the last position on the final page would otherwise strand the
  // view on a page that no longer exists.
  const safePage = Math.min(page, pageCount);
  const visible = history.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (history.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="No closed positions yet"
        description="Positions you close or that get liquidated will show up here with their realised result."
      />
    );
  }

  return (
    <>
    <table className="w-full min-w-[720px] text-left text-sm">
      <thead>
        <tr className="border-b border-white/5 text-xs text-white/40">
          <th className="px-4 py-3 font-medium sm:px-6">Market</th>
          <th className="px-4 py-3 font-medium">Side</th>
          <th className="px-4 py-3 font-medium">Size</th>
          <th className="px-4 py-3 font-medium">Entry Price</th>
          <th className="px-4 py-3 font-medium">Close Price</th>
          <th className="px-4 py-3 font-medium">Status</th>
          <th className="px-4 py-3 font-medium">PnL</th>
          <th className="px-4 py-3 font-medium">Closed</th>
        </tr>
      </thead>
      <tbody>
        {visible.map((position) => {
          const pnl = position.realizedPnl ?? 0;
          const profit = pnl >= 0;
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
                {position.closePrice ? formatPrice(position.closePrice) : "—"}
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

    <Pagination
      page={safePage}
      pageCount={pageCount}
      totalItems={history.length}
      pageSize={PAGE_SIZE}
      onPageChange={setPage}
    />
    </>
  );
}

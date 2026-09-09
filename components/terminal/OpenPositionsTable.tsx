"use client";

import { CandlestickChart } from "lucide-react";
import { useTerminal } from "@/contexts/TerminalContext";
import { useToast } from "@/contexts/ToastContext";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatPercent, formatPrice, priceDecimals } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CryptoIcon } from "@/components/ui/CryptoIcon";
import { getMarketConfig } from "@/lib/markets";
import { liquidationProgress, priceMovePercent } from "@/lib/calculations";
import { cn } from "@/lib/utils";

export function OpenPositionsTable() {
  const { openPositions, closePosition } = useTerminal();
  const { toast } = useToast();

  if (openPositions.length === 0) {
    return (
      <EmptyState
        icon={CandlestickChart}
        title="No open positions"
        description="Place an order from the panel on the right and it will appear here, marked live against its own market."
      />
    );
  }

  return (
    <table className="w-full min-w-[820px] text-left text-sm">
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
              <td className="px-4 py-3">
                <span className="font-mono text-rose-400">
                  {formatPrice(position.liquidationPrice)}
                </span>
                {/* Formatted to the price's precision, not the gap's own - a
                    $52 gap on BTC should read $52.43, not $52.431. */}
                <span className="mt-0.5 block font-mono text-[11px] text-white/40">
                  {formatCurrency(
                    Math.abs(position.markPrice - position.liquidationPrice),
                    priceDecimals(position.markPrice)
                  )}{" "}
                  away
                </span>
                <LiquidationMeter
                  progress={liquidationProgress(
                    position.entryPrice,
                    position.markPrice,
                    position.liquidationPrice,
                    position.side
                  )}
                />
              </td>
              <td className="px-4 py-3">
                <span
                  className={cn("font-mono", profit ? "text-emerald-400" : "text-rose-400")}
                >
                  {formatCurrency(position.pnl)}
                </span>
                {/* Both denominators, named. The price figure is what the
                    leverage warning refers to; the margin figure is this
                    times the leverage. */}
                <span className="mt-0.5 block font-mono text-[11px] text-white/40">
                  price {formatPercent(priceMovePercent(position.entryPrice, position.markPrice), 3)}
                  {" · "}
                  margin {formatPercent(position.pnlPercent)}
                </span>
              </td>
              <td className="px-4 py-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    closePosition(position.id);
                    toast({
                      variant: profit ? "success" : "warning",
                      title: `${position.symbol} position closed`,
                      description: `${profit ? "Profit" : "Loss"} of ${formatCurrency(Math.abs(position.pnl))} at ${formatPrice(position.markPrice)}.`,
                    });
                  }}
                >
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

/**
 * Distance travelled toward liquidation, 0-100%. The raw percentages can't be
 * compared across leverages - this can, and it's the number that answers "how
 * close am I?" without having to know which denominator you're looking at.
 */
function LiquidationMeter({ progress }: { progress: number }) {
  const percent = Math.round(progress * 100);
  const tone =
    progress >= 0.75 ? "bg-rose-500" : progress >= 0.5 ? "bg-amber-400" : "bg-emerald-500";

  return (
    <span className="mt-1.5 flex items-center gap-1.5">
      <span
        role="meter"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progress toward liquidation"
        className="block h-1 w-16 overflow-hidden rounded-full bg-white/10"
      >
        <span
          className={cn("block h-full rounded-full transition-all duration-300", tone)}
          style={{ width: `${percent}%` }}
        />
      </span>
      <span className="font-mono text-[11px] text-white/40">{percent}% to liq.</span>
    </span>
  );
}

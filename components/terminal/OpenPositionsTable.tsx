"use client";

import { useState } from "react";
import { CandlestickChart } from "lucide-react";
import { useTerminal } from "@/contexts/TerminalContext";
import { useExchange } from "@/contexts/ExchangeContext";
import { useToast } from "@/contexts/ToastContext";
import {
  LiveOrderConfirm,
  type LiveOrderDraft,
} from "@/components/terminal/LiveOrderConfirm";
import { closeLivePosition } from "@/lib/exchange/orders";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatPercent, formatPrice, priceDecimals } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CryptoIcon } from "@/components/ui/CryptoIcon";
import { getMarketConfig } from "@/lib/markets";
import { liquidationProgress, priceMovePercent } from "@/lib/calculations";
import { cn } from "@/lib/utils";

/** A live position's id is `live:<venue symbol>:<side>`, which is the only
 * place the venue's own symbol survives the adapter - the display symbol is our
 * label ("BTC-PERP"), and the market id falls back to BTC for anything we don't
 * list, so neither can be trusted to address an order. */
function venueSymbolFromId(id: string): string | null {
  if (!id.startsWith("live:")) return null;
  const parts = id.split(":");
  return parts.length >= 3 ? parts[1] : null;
}

export function OpenPositionsTable() {
  const { openPositions, live } = useTerminal();
  const { credentials, openUnlock } = useExchange();
  const { toast } = useToast();
  const [draft, setDraft] = useState<LiveOrderDraft | null>(null);
  const [sending, setSending] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  const handleConfirmClose = async () => {
    const creds = credentials();
    if (!draft || !creds) {
      setCloseError("Your key is locked. Unlock it and try again.");
      return;
    }
    setSending(true);
    setCloseError(null);
    try {
      await closeLivePosition(creds, draft.symbol, draft.side, draft.qty);
      setDraft(null);
      toast({
        variant: "success",
        title: "Close order sent to Bybit",
        description: `Reduce-only ${draft.qty} ${draft.symbol}. The position clears once it fills.`,
      });
      live.refresh();
    } catch (caught) {
      setCloseError(
        caught instanceof Error ? caught.message : "The exchange rejected the close."
      );
    } finally {
      setSending(false);
    }
  };

  if (openPositions.length === 0) {
    return (
      <EmptyState
        icon={CandlestickChart}
        title={live.locked ? "Exchange key locked" : "No open positions"}
        description={
          live.locked
            ? "Unlock your exchange key in Settings to see the positions open on this account."
            : live.active
              ? "Positions opened on your Bybit account appear here."
              : "Place an order from the panel on the right and it will appear here, marked live against its own market."
        }
      />
    );
  }

  return (
    <>
      <table className="w-full min-w-[900px] text-left text-sm">
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
                {/* An exchange omits the liquidation price when a position
                    can't be liquidated. Rendering that as a number would say
                    "liquidation at $0.00", which is the worst misreading
                    available on this screen. */}
                {Number.isFinite(position.liquidationPrice) ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <span className="font-mono text-white/40">—</span>
                    <span className="mt-0.5 block text-[11px] text-white/30">
                      not reported
                    </span>
                  </>
                )}
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
                    // A position is closed by a reduce-only order at the
                    // exchange. There is no local close any more: the demo
                    // engine that used to offer one held no record of a real
                    // position and would have reported a close that never
                    // happened.
                    if (live.locked) {
                      openUnlock();
                      return;
                    }
                    const venueSymbol = venueSymbolFromId(position.id);
                    if (!venueSymbol) return;
                    setCloseError(null);
                    setDraft({
                      symbol: venueSymbol,
                      side: position.side,
                      qty: position.size,
                      notional: position.size * position.markPrice,
                      leverage: position.leverage,
                      markPrice: position.markPrice,
                      reduceOnly: true,
                    });
                  }}
                >
                  {live.locked ? "Unlock" : "Close"}
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
      </table>

      <LiveOrderConfirm
        draft={draft}
        busy={sending}
        error={closeError}
        onConfirm={handleConfirmClose}
        onClose={() => {
          setDraft(null);
          setCloseError(null);
        }}
      />
    </>
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

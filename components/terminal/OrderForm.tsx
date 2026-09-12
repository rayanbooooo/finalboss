"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useTerminal } from "@/contexts/TerminalContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useToast } from "@/contexts/ToastContext";
import { LeverageSlider } from "@/components/terminal/LeverageSlider";
import { Button } from "@/components/ui/Button";
import {
  calcLiquidationPrice,
  calcPositionSize,
  clampLeverage,
  liquidationDistancePercent,
  MIN_LEVERAGE,
} from "@/lib/calculations";
import { formatCurrency, formatPrice, priceDecimals } from "@/lib/format";
import type { OrderSide } from "@/types/trading";
import { cn } from "@/lib/utils";

const EXECUTED_LABEL_MS = 1200;
const BALANCE_FRACTIONS = [0.25, 0.5, 0.75, 1];

export function OrderForm() {
  const { market, activeMarketId, openPosition, availableBalance, accountMode, live } =
    useTerminal();
  const bestBid = market.orderbook.bids[0];
  const bestAsk = market.orderbook.asks[0];
  const { profile } = useOnboarding();
  const { toast } = useToast();
  const [side, setSide] = useState<OrderSide>("long");
  const [leverage, setLeverage] = useState(() => clampLeverage(profile?.defaultLeverage ?? MIN_LEVERAGE));
  const [margin, setMargin] = useState(1000);
  const [justExecuted, setJustExecuted] = useState(false);

  const liquidationPrice = useMemo(
    () => calcLiquidationPrice(market.price, leverage, side),
    [market.price, leverage, side]
  );
  const size = useMemo(
    () => calcPositionSize(margin, leverage, market.price),
    [margin, leverage, market.price]
  );

  const exceedsBalance = margin > availableBalance;
  // Placing orders on a connected account is not wired up yet. Until it is,
  // the form must refuse rather than quietly open a demo position while the
  // panel beside it says TESTNET or REAL FUNDS - a fake fill presented as a
  // real one is worse than no fill at all.
  const readOnlyLive = live.active;

  const handleExecute = () => {
    if (margin <= 0 || exceedsBalance || readOnlyLive) return;
    openPosition({
      marketId: activeMarketId,
      symbol: market.symbol,
      side,
      leverage,
      margin,
      entryPrice: market.price,
    });
    toast({
      variant: "success",
      title: "Order filled",
      description: `${side === "long" ? "Long" : "Short"} ${market.symbol} at ${formatPrice(market.price)} with ${leverage}x on ${formatCurrency(margin)} margin.`,
    });
    setJustExecuted(true);
    setTimeout(() => setJustExecuted(false), EXECUTED_LABEL_MS);
  };

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white">Place Order</span>
        <span className="rounded-md border border-white/10 px-2 py-0.5 font-mono text-[11px] text-white/50">
          {leverage}x
        </span>
      </div>

      <div data-tour="direction" className="grid grid-cols-2 gap-2 rounded-xl bg-white/5 p-1">
        <button
          type="button"
          onClick={() => setSide("long")}
          className={cn(
            "min-h-11 rounded-lg text-sm font-semibold transition-colors",
            side === "long" ? "bg-emerald-500 text-base-950 shadow-glow-emerald" : "text-white/60"
          )}
        >
          Long
        </button>
        <button
          type="button"
          onClick={() => setSide("short")}
          className={cn(
            "min-h-11 rounded-lg text-sm font-semibold transition-colors",
            side === "short" ? "bg-rose-500 text-white shadow-glow-rose" : "text-white/60"
          )}
        >
          Short
        </button>
      </div>

      {bestBid && bestAsk && (
        <div className="flex items-center justify-between font-mono text-xs">
          <span className="flex items-center gap-1 text-emerald-400">
            <ArrowUp className="h-3 w-3" />
            {formatPrice(bestBid.price)}
          </span>
          <span className="flex items-center gap-1 text-rose-400">
            <ArrowDown className="h-3 w-3" />
            {formatPrice(bestAsk.price)}
          </span>
        </div>
      )}

      <div data-tour="amount">
        <label htmlFor="margin" className="mb-1.5 block text-sm font-medium text-white/70">
          Margin (USDC)
        </label>
        <input
          id="margin"
          type="number"
          min={0}
          value={margin}
          onChange={(event) => setMargin(Number(event.target.value))}
          className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white focus:border-violet-500 focus:outline-none"
        />
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {BALANCE_FRACTIONS.map((fraction) => {
            const value = Math.floor(availableBalance * fraction);
            return (
              <button
                key={fraction}
                type="button"
                disabled={availableBalance <= 0}
                onClick={() => setMargin(value)}
                className={cn(
                  "min-h-8 rounded-lg border text-xs font-medium transition-colors disabled:opacity-40",
                  margin === value && value > 0
                    ? "border-violet-500/50 bg-violet-500/15 text-violet-200"
                    : "border-white/10 text-white/50 hover:border-white/20 hover:text-white/80"
                )}
              >
                {fraction * 100}%
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-xs">
          <span className="text-white/40">Available</span>
          {/* A live account whose balance hasn't loaded is unknown, not zero.
              Rendering $0.00 would read as "this account is empty". */}
          <span className="font-mono tabular-nums text-white/60">
            {live.active && !live.ready ? "—" : formatCurrency(availableBalance)}
          </span>
        </div>
      </div>

      {readOnlyLive && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm leading-relaxed text-amber-200">
          You&apos;re viewing your {accountMode === "real" ? "real" : "testnet"} Bybit
          account. Placing orders on it isn&apos;t enabled yet - switch to Demo to trade
          here.
        </p>
      )}

      {exceedsBalance && !readOnlyLive && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          Margin exceeds your available balance of {formatCurrency(availableBalance)}.
        </p>
      )}

      <div data-tour="leverage">
        <LeverageSlider leverage={leverage} onChange={setLeverage} price={market.price} />
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
        <Row label="Position Size" value={`${size.toFixed(4)} ${activeMarketId}`} />
        <Row label="Entry Price" value={formatPrice(market.price)} />
        <Row
          label="Est. Liq. Price"
          value={formatPrice(liquidationPrice)}
          valueClassName="text-rose-400"
          // Distance is formatted to the price's precision, not its own - a
          // $64 gap on BTC should read $64.47, not $64.469.
          sub={`${formatCurrency(Math.abs(market.price - liquidationPrice), priceDecimals(market.price))} away · ${liquidationDistancePercent(leverage).toFixed(3)}% of price`}
        />
      </div>

      <Button
        data-tour="submit"
        variant={side === "long" ? "secondary" : "danger"}
        size="lg"
        onClick={handleExecute}
        disabled={margin <= 0 || exceedsBalance || readOnlyLive}
        className="w-full"
      >
        {readOnlyLive
          ? "Read-only on this account"
          : justExecuted
            ? "Order Filled"
            : `${side === "long" ? "Long" : "Short"} ${market.symbol}`}
      </Button>
    </div>
  );
}

function Row({
  label,
  value,
  valueClassName,
  sub,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  sub?: string;
}) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-white/50">{label}</span>
      <span className="text-right">
        <span className={cn("block font-mono text-white/85", valueClassName)}>{value}</span>
        {sub && (
          <span className="mt-0.5 block font-mono text-[11px] text-white/40">{sub}</span>
        )}
      </span>
    </div>
  );
}

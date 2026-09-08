"use client";

import { useMemo, useState } from "react";
import { useTerminal } from "@/contexts/TerminalContext";
import { LeverageSlider } from "@/components/terminal/LeverageSlider";
import { Button } from "@/components/ui/Button";
import { calcLiquidationPrice, calcPositionSize } from "@/lib/calculations";
import { formatCurrency } from "@/lib/format";
import type { OrderSide } from "@/types/trading";
import { cn } from "@/lib/utils";

const EXECUTED_LABEL_MS = 1200;

export function OrderForm() {
  const { market, openPosition } = useTerminal();
  const [side, setSide] = useState<OrderSide>("long");
  const [leverage, setLeverage] = useState(10);
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

  const handleExecute = () => {
    if (margin <= 0) return;
    openPosition({ symbol: market.symbol, side, leverage, margin, entryPrice: market.price });
    setJustExecuted(true);
    setTimeout(() => setJustExecuted(false), EXECUTED_LABEL_MS);
  };

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-5">
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-white/5 p-1">
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

      <LeverageSlider leverage={leverage} onChange={setLeverage} />

      <div>
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
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
        <Row label="Position Size" value={`${size.toFixed(4)} BTC`} />
        <Row label="Entry Price" value={formatCurrency(market.price)} />
        <Row
          label="Est. Liquidation Price"
          value={formatCurrency(liquidationPrice)}
          valueClassName="text-rose-400"
        />
      </div>

      <Button
        variant={side === "long" ? "secondary" : "danger"}
        size="lg"
        onClick={handleExecute}
        disabled={margin <= 0}
        className="w-full"
      >
        {justExecuted ? "Order Filled" : `${side === "long" ? "Long" : "Short"} ${market.symbol}`}
      </Button>
    </div>
  );
}

function Row({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-white/50">{label}</span>
      <span className={cn("font-mono text-white/85", valueClassName)}>{value}</span>
    </div>
  );
}

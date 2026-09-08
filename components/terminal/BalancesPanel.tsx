"use client";

import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useTerminal } from "@/contexts/TerminalContext";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Account summary in the terminal's right column. Mirrors the kit's
 * Balances card, but for a single settlement asset - this app margins
 * everything in USDC rather than holding a basket of coins.
 */
export function BalancesPanel() {
  const { availableBalance, equity, lockedMargin, openFunding } = useTerminal();
  const unrealised = equity - availableBalance - lockedMargin;

  return (
    <div className="border-t border-white/5 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-white/40">
          Balances
        </span>
        <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-200">
          DEMO FUNDS
        </span>
      </div>

      <div className="flex flex-col gap-2 text-sm">
        <Row label="Available" value={formatCurrency(availableBalance)} strong />
        <Row label="Margin in use" value={formatCurrency(lockedMargin)} />
        <Row
          label="Unrealised P&L"
          value={formatCurrency(unrealised)}
          valueClassName={unrealised >= 0 ? "text-emerald-400" : "text-rose-400"}
        />
        <div className="mt-1 border-t border-white/5 pt-2">
          <Row label="Account equity" value={formatCurrency(equity)} strong />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => openFunding("deposit")}
          className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 text-xs font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
        >
          <ArrowDownToLine className="h-3.5 w-3.5" />
          Deposit
        </button>
        <button
          type="button"
          onClick={() => openFunding("withdraw")}
          className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 text-xs font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
        >
          <ArrowUpFromLine className="h-3.5 w-3.5" />
          Withdraw
        </button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  valueClassName,
}: {
  label: string;
  value: string;
  strong?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-white/45">{label}</span>
      <span
        className={cn(
          "font-mono tabular-nums",
          strong ? "font-semibold text-white" : "text-white/85",
          valueClassName
        )}
      >
        {value}
      </span>
    </div>
  );
}

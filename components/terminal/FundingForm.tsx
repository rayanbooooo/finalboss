"use client";

import { useState } from "react";
import { useTerminal } from "@/contexts/TerminalContext";
import { useToast } from "@/contexts/ToastContext";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const QUICK_AMOUNTS = [500, 1000, 5000, 10000];
const CLOSE_DELAY_MS = 900;

interface FundingFormProps {
  mode: "deposit" | "withdraw";
  onDone: () => void;
}

export function FundingForm({ mode, onDone }: FundingFormProps) {
  const { availableBalance, deposit, withdraw } = useTerminal();
  const { toast } = useToast();
  const [amount, setAmount] = useState(1000);
  const [done, setDone] = useState(false);

  const isWithdrawal = mode === "withdraw";
  const exceedsBalance = isWithdrawal && amount > availableBalance;
  const invalid = amount <= 0 || exceedsBalance;

  const handleSubmit = () => {
    if (invalid) return;
    if (isWithdrawal) withdraw(amount);
    else deposit(amount);
    toast({
      variant: "success",
      title: isWithdrawal ? "Withdrawal complete" : "Deposit complete",
      description: `${formatCurrency(amount)} of demo funds ${isWithdrawal ? "withdrawn from" : "added to"} your balance.`,
    });
    setDone(true);
    setTimeout(onDone, CLOSE_DELAY_MS);
  };

  return (
    <div>
      <p className="mb-5 text-sm leading-relaxed text-white/50">
        {isWithdrawal
          ? "Moves demo funds out of your trading balance. No real money leaves anywhere."
          : "Adds demo funds to your trading balance. No real payment is taken and no real money is involved."}
      </p>

      <div className="mb-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm">
        <span className="text-white/50">Available</span>
        <span className="font-mono tabular-nums text-white/85">
          {formatCurrency(availableBalance)}
        </span>
      </div>

      <label htmlFor="amount" className="mb-1.5 block text-sm font-medium text-white/70">
        Amount (USDC)
      </label>
      <input
        id="amount"
        type="number"
        min={0}
        value={amount}
        onChange={(event) => setAmount(Number(event.target.value))}
        className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white focus:border-violet-500 focus:outline-none"
      />

      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {QUICK_AMOUNTS.map((quick) => (
          <button
            key={quick}
            type="button"
            onClick={() => setAmount(quick)}
            className={cn(
              "min-h-8 rounded-lg border text-xs font-medium transition-colors",
              amount === quick
                ? "border-violet-500/50 bg-violet-500/15 text-violet-200"
                : "border-white/10 text-white/50 hover:border-white/20 hover:text-white/80"
            )}
          >
            ${quick.toLocaleString("en-US")}
          </button>
        ))}
      </div>

      {isWithdrawal && (
        <button
          type="button"
          onClick={() => setAmount(Math.max(0, Math.floor(availableBalance)))}
          className="mt-2 text-xs text-violet-300 hover:underline"
        >
          Withdraw everything available
        </button>
      )}

      {exceedsBalance && (
        <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          That&apos;s more than your available balance of{" "}
          {formatCurrency(availableBalance)}. Margin locked in open positions
          can&apos;t be withdrawn until those positions close.
        </p>
      )}

      <Button
        variant={isWithdrawal ? "outline" : "primary"}
        size="lg"
        onClick={handleSubmit}
        disabled={invalid || done}
        className="mt-5 w-full"
      >
        {done
          ? isWithdrawal
            ? "Withdrawn"
            : "Deposited"
          : `${isWithdrawal ? "Withdraw" : "Deposit"} ${formatCurrency(amount)}`}
      </Button>
    </div>
  );
}

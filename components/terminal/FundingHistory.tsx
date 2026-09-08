"use client";

import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useTerminal } from "@/contexts/TerminalContext";
import { formatCurrency, formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";

export function FundingHistory() {
  const { fundingHistory } = useTerminal();

  if (fundingHistory.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-white/40">
        No deposits or withdrawals yet.
      </p>
    );
  }

  return (
    <table className="w-full min-w-[520px] text-left text-sm">
      <thead>
        <tr className="border-b border-white/5 text-xs text-white/40">
          <th className="px-4 py-3 font-medium">Type</th>
          <th className="px-4 py-3 font-medium">Asset</th>
          <th className="px-4 py-3 font-medium">Amount</th>
          <th className="px-4 py-3 font-medium">Note</th>
          <th className="px-4 py-3 font-medium">Date</th>
        </tr>
      </thead>
      <tbody>
        {fundingHistory.map((entry) => {
          const isDeposit = entry.kind === "deposit";
          const Icon = isDeposit ? ArrowDownToLine : ArrowUpFromLine;
          return (
            <tr key={entry.id} className="border-b border-white/5 odd:bg-white/[0.02]">
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 font-medium",
                    isDeposit ? "text-emerald-400" : "text-white/70"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {isDeposit ? "Deposit" : "Withdrawal"}
                </span>
              </td>
              <td className="px-4 py-3 text-white/70">{entry.asset}</td>
              <td
                className={cn(
                  "px-4 py-3 font-mono tabular-nums",
                  isDeposit ? "text-emerald-400" : "text-white/80"
                )}
              >
                {isDeposit ? "+" : "−"}
                {formatCurrency(entry.amount)}
              </td>
              <td className="px-4 py-3 text-white/45">{entry.note ?? "—"}</td>
              <td className="px-4 py-3 text-white/50">{formatTimestamp(entry.createdAt)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

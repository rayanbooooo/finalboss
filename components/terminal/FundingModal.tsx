"use client";

import { useTerminal } from "@/contexts/TerminalContext";
import { Modal } from "@/components/ui/Modal";
import { FundingForm } from "@/components/terminal/FundingForm";
import { formatCurrency, formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";

const RECENT_ENTRIES = 5;

export function FundingModal() {
  const { fundingMode, closeFunding, fundingHistory } = useTerminal();
  const recent = fundingHistory.slice(0, RECENT_ENTRIES);

  return (
    <Modal
      isOpen={fundingMode !== null}
      onClose={closeFunding}
      title={fundingMode === "withdraw" ? "Withdraw funds" : "Deposit funds"}
    >
      {fundingMode && <FundingForm mode={fundingMode} onDone={closeFunding} />}

      {recent.length > 0 && (
        <div className="mt-6 border-t border-white/5 pt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
            Recent activity
          </h3>
          <ul className="flex flex-col gap-1.5 text-sm">
            {recent.map((entry) => {
              const isDeposit = entry.kind === "deposit";
              return (
                <li key={entry.id} className="flex items-center justify-between gap-3">
                  <span className="truncate text-white/50">
                    {entry.note ?? (isDeposit ? "Deposit" : "Withdrawal")}
                    <span className="ml-2 text-white/30">
                      {formatTimestamp(entry.createdAt)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-mono tabular-nums",
                      isDeposit ? "text-emerald-400" : "text-white/70"
                    )}
                  >
                    {isDeposit ? "+" : "−"}
                    {formatCurrency(entry.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Modal>
  );
}

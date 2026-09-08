"use client";

import { LogOut } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { truncateAddress } from "@/lib/format";

export function ConnectedBadge() {
  const { address, disconnect } = useWallet();
  if (!address) return null;

  return (
    <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
      <span className="h-2 w-2 animate-pulse-glow rounded-full bg-emerald-400" />
      <span className="font-mono text-sm text-emerald-300">
        {truncateAddress(address)}
      </span>
      <button
        type="button"
        onClick={disconnect}
        aria-label="Disconnect wallet"
        className="ml-1 flex h-7 w-7 items-center justify-center rounded-full text-emerald-300/70 hover:bg-emerald-500/20 hover:text-emerald-200"
      >
        <LogOut className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

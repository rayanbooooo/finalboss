"use client";

import { Check } from "lucide-react";
import type { WalletId, WalletOption } from "@/types/wallet";
import { WALLET_ICONS } from "@/lib/mockData";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

interface WalletOptionButtonProps {
  option: WalletOption;
  status: "idle" | "connecting" | "connected";
  isActive: boolean;
  onClick: (id: WalletId) => void;
}

export function WalletOptionButton({
  option,
  status,
  isActive,
  onClick,
}: WalletOptionButtonProps) {
  const Icon = WALLET_ICONS[option.id];
  const connecting = isActive && status === "connecting";
  const connected = isActive && status === "connected";

  return (
    <button
      type="button"
      onClick={() => onClick(option.id)}
      disabled={status === "connecting"}
      className={cn(
        "flex min-h-14 w-full items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition-colors hover:bg-white/10 disabled:opacity-50",
        connected && "border-emerald-500/40 bg-emerald-500/10"
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-violet-300">
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex-1">
        <span className="block text-sm font-medium text-white">{option.name}</span>
        <span className="block text-xs text-white/50">{option.description}</span>
      </span>
      {connecting && <Spinner className="h-5 w-5 text-violet-300" />}
      {connected && <Check className="h-5 w-5 text-emerald-400" />}
    </button>
  );
}

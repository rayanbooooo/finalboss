"use client";

import { Wallet } from "lucide-react";
import type { Connector } from "wagmi";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

interface WalletOptionButtonProps {
  connector: Connector;
  pending: boolean;
  onClick: () => void;
}

export function WalletOptionButton({ connector, pending, onClick }: WalletOptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="flex min-h-14 w-full items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition-colors hover:bg-white/10 disabled:opacity-50"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/10 text-violet-300">
        {connector.icon ? (
          // eslint-disable-next-line @next/next/no-img-element -- small inline data-URI icon from the wallet extension, not a fetched asset
          <img src={connector.icon} alt="" className="h-6 w-6" />
        ) : (
          <Wallet className="h-5 w-5" />
        )}
      </span>
      <span className="flex-1">
        <span className="block text-sm font-medium text-white">{connector.name}</span>
      </span>
      {pending && <Spinner className="h-5 w-5 text-violet-300" />}
    </button>
  );
}

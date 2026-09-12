"use client";

import { useTerminal, type AccountMode } from "@/contexts/TerminalContext";
import { useExchange } from "@/contexts/ExchangeContext";
import { cn } from "@/lib/utils";

/**
 * Which account the terminal is operating on.
 *
 * Note the wording: "Demo / Testnet / Real funds", never "Live". The header
 * beside this already uses LIVE to mean the price feed is real, and letting
 * one word carry both meanings would blur the single most important
 * distinction in the app.
 */
const OPTIONS: { value: AccountMode; label: string; needsKey: boolean }[] = [
  { value: "demo", label: "Demo", needsKey: false },
  { value: "testnet", label: "Testnet", needsKey: true },
  { value: "real", label: "Real funds", needsKey: true },
];

export function AccountModeSwitch() {
  const { accountMode, setAccountMode } = useTerminal();
  const { isConnected, testnet } = useExchange();

  return (
    <div
      className="flex w-full items-center gap-0.5 rounded-lg bg-white/5 p-0.5 lg:w-auto"
      role="group"
      aria-label="Account mode"
    >
      {OPTIONS.map((option) => {
        // A testnet key can't trade the real book and vice versa, so only the
        // network this key belongs to is offered.
        const wrongNetwork =
          option.needsKey && isConnected && (option.value === "testnet") !== testnet;
        const disabled = (option.needsKey && !isConnected) || wrongNetwork;
        const active = accountMode === option.value;

        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            title={
              option.needsKey && !isConnected
                ? "Connect an exchange account in Settings first"
                : wrongNetwork
                  ? `Your connected key is for ${testnet ? "testnet" : "the real account"}`
                  : undefined
            }
            onClick={() => setAccountMode(option.value)}
            className={cn(
              "min-h-9 flex-1 rounded-md px-2.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-30 lg:min-h-0 lg:flex-none lg:py-1",
              active
                ? option.value === "real"
                  ? "bg-rose-500/20 text-rose-200"
                  : option.value === "testnet"
                    ? "bg-emerald-500/20 text-emerald-200"
                    : "bg-white/10 text-white"
                : "text-white/50 hover:text-white/80"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

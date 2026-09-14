"use client";

import { useEffect } from "react";
import { Wallet } from "lucide-react";
import { formatUnits } from "viem";
import { useAccount, useBalance, useDisconnect } from "wagmi";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useWalletModal } from "@/contexts/WalletModalContext";
import { Button } from "@/components/ui/Button";
import { truncateAddress } from "@/lib/format";

/**
 * A wallet as an optional detail on an account, which is all it has ever been.
 *
 * It used to be a way to sign up, which made it an identity - and an identity
 * that created no account anywhere, since connecting a wallet registers nothing
 * on any server and the site never asks it to sign. That is why the terminal
 * header showed two chips for one person.
 *
 * What it genuinely offers is written on the tin below: an address on the
 * account, readable on another device. Nothing here pretends otherwise, and
 * nothing gates on it.
 */
export function LinkedWallet() {
  const { address, isConnected } = useAccount();
  const { mutate: disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address });
  const { open: openWalletModal } = useWalletModal();
  const { profile, updateProfile } = useOnboarding();

  const saved = profile?.walletAddress ?? null;

  // Persist whatever is connected, and clear it when it is unlinked, so the
  // account and the browser agree. Comparing before writing keeps this from
  // looping: updateProfile changes `profile`, which re-runs this effect.
  useEffect(() => {
    const current = isConnected ? (address ?? null) : null;
    if (current === saved) return;
    void updateProfile({ walletAddress: current ?? undefined }).catch(() => {
      // Non-critical: the wallet still works in this tab, it just will not
      // follow the account to another device.
    });
  }, [isConnected, address, saved, updateProfile]);

  const formattedBalance =
    balance && `${Number(formatUnits(balance.value, balance.decimals)).toFixed(4)} ${balance.symbol}`;

  return (
    <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <h2 className="text-sm font-semibold text-white">Linked wallet</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-white/55">
        Optional. Your FinalBoss account is your email — a wallet is just an
        address saved against it. It is never asked to sign anything, it holds no
        funds here, and trading works exactly the same without one.
      </p>

      {isConnected && address ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="font-mono text-sm text-emerald-300">
              {truncateAddress(address)}
            </span>
            {formattedBalance && (
              <span className="hidden font-mono text-xs text-emerald-300/70 sm:inline">
                {formattedBalance}
              </span>
            )}
          </span>
          <Button variant="outline" size="md" onClick={() => disconnect()}>
            Unlink
          </Button>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="outline" size="lg" onClick={openWalletModal}>
            <Wallet className="h-4 w-4" />
            Link a wallet
          </Button>
          {saved && (
            <span className="text-xs text-white/40">
              Last linked {truncateAddress(saved)} — reconnect to confirm it is
              still yours.
            </span>
          )}
        </div>
      )}
    </section>
  );
}

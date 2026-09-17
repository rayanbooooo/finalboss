"use client";

import { useState } from "react";
import { Check, ShieldCheck, Wallet } from "lucide-react";
import { useAccount } from "wagmi";

import { useOnboarding } from "@/contexts/OnboardingContext";
import { useWalletModal } from "@/contexts/WalletModalContext";
import { useAster } from "@/contexts/AsterContext";
import { AsterApprovalModal } from "@/components/terminal/AsterApprovalModal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

/**
 * Approving Aster, from the settings screen.
 *
 * Deliberately alongside the Bybit panel rather than replacing it. Aster is
 * where this terminal is going, but it cannot place an order end to end yet,
 * and removing the one working venue before the new one arrives would leave
 * the app unable to trade at all.
 */
export function AsterPanel() {
  const { userId } = useOnboarding();
  const { isConnected } = useAccount();
  const { open: openWallet } = useWalletModal();
  const { agent, approved } = useAster();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-white">Aster</h2>
        {approved ? (
          <Badge variant="emerald">Approved</Badge>
        ) : (
          <Badge variant="violet">Up to 200x</Badge>
        )}
      </div>

      {approved && agent ? (
        <>
          <p className="mt-1.5 flex items-start gap-2 text-sm leading-relaxed text-white/55">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <span>
              Trading key{" "}
              <span className="font-mono text-white/80">…{agent.address.slice(-8)}</span>{" "}
              is approved until {new Date(agent.expiresAt).toLocaleDateString()}. It can
              trade perpetuals and nothing else.
            </span>
          </p>
          <Button variant="outline" size="lg" className="mt-4" onClick={() => setModalOpen(true)}>
            Manage approval
          </Button>
        </>
      ) : (
        <>
          <p className="mt-1.5 text-sm leading-relaxed text-white/55">
            Trade perpetuals on your own Aster account, up to 200x on BTC. One wallet
            signature approves a trading key that can open and close positions — and
            cannot withdraw, because it is never granted permission to.
          </p>

          {isConnected ? (
            <Button variant="primary" size="lg" className="mt-4" onClick={() => setModalOpen(true)}>
              <ShieldCheck className="h-4 w-4" />
              Approve trading
            </Button>
          ) : (
            // Approving requires a signature from the wallet that owns the
            // funds, so connecting is genuinely the first step rather than a
            // disabled button the user has to guess the reason for.
            <Button variant="primary" size="lg" className="mt-4" onClick={openWallet}>
              <Wallet className="h-4 w-4" />
              Connect wallet first
            </Button>
          )}
        </>
      )}

      <AsterApprovalModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        userId={userId}
      />
    </section>
  );
}

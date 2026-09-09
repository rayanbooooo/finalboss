"use client";

import { useState } from "react";
import { Link2, Lock, LockOpen, Unlink } from "lucide-react";
import { useExchange } from "@/contexts/ExchangeContext";
import { useToast } from "@/contexts/ToastContext";
import { ConnectExchangeModal } from "@/components/terminal/ConnectExchangeModal";
import { UnlockModal } from "@/components/terminal/UnlockModal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export function ExchangePanel() {
  const { isConnected, isUnlocked, connection, sessionOnly, testnet, disconnect, lock } =
    useExchange();
  const { toast } = useToast();
  const [connectOpen, setConnectOpen] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);

  const handleDisconnect = async () => {
    await disconnect();
    toast({ variant: "success", title: "Exchange key removed" });
  };

  return (
    <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-white">Exchange account</h2>
        {isConnected && (
          <Badge variant={testnet ? "emerald" : "amber"}>
            {testnet ? "Testnet" : "Live account"}
          </Badge>
        )}
      </div>

      {!isConnected ? (
        <>
          <p className="mt-1.5 text-sm leading-relaxed text-white/55">
            Connect your own Bybit account to place real orders. Orders execute on your
            account at the exchange - this site never holds your funds, and a key that
            can withdraw is refused.
          </p>
          <Button variant="primary" size="lg" className="mt-4" onClick={() => setConnectOpen(true)}>
            <Link2 className="h-4 w-4" />
            Connect exchange
          </Button>
        </>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-white/45">Key</span>
            <span className="font-mono text-white/80">…{connection?.apiKey.slice(-6)}</span>
            <span
              className={
                isUnlocked
                  ? "flex items-center gap-1 text-emerald-400"
                  : "flex items-center gap-1 text-white/40"
              }
            >
              {isUnlocked ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
              {isUnlocked ? "Unlocked" : "Locked"}
            </span>
          </div>

          <p className="mt-2 text-xs leading-relaxed text-white/40">
            {sessionOnly
              ? "Not saved - the secret is held for this session only and disappears when you close the tab."
              : isUnlocked
                ? "The secret is decrypted in memory and locks itself after 15 minutes of inactivity."
                : "The secret is stored encrypted. Unlock it to place or close orders."}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {!isUnlocked && !sessionOnly && (
              <Button variant="primary" size="lg" onClick={() => setUnlockOpen(true)}>
                <LockOpen className="h-4 w-4" />
                Unlock
              </Button>
            )}
            {isUnlocked && (
              <Button variant="outline" size="lg" onClick={lock}>
                <Lock className="h-4 w-4" />
                Lock
              </Button>
            )}
            <Button variant="outline" size="lg" onClick={handleDisconnect}>
              <Unlink className="h-4 w-4" />
              Disconnect
            </Button>
          </div>
        </>
      )}

      <ConnectExchangeModal isOpen={connectOpen} onClose={() => setConnectOpen(false)} />
      <UnlockModal isOpen={unlockOpen} onClose={() => setUnlockOpen(false)} />
    </section>
  );
}

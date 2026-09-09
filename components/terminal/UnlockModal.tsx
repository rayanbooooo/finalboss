"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { useExchange } from "@/contexts/ExchangeContext";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface UnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UnlockModal({ isOpen, onClose }: UnlockModalProps) {
  const { unlock, connection, testnet } = useExchange();
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      await unlock(passphrase);
      setPassphrase("");
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not unlock that key.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Unlock your exchange key">
      <p className="text-sm leading-relaxed text-white/60">
        Your API secret is stored encrypted and is decrypted here in your browser.
        {connection && (
          <>
            {" "}
            Key{" "}
            <span className="font-mono text-white/80">
              …{connection.apiKey.slice(-6)}
            </span>{" "}
            on {testnet ? "testnet" : "the live account"}.
          </>
        )}
      </p>

      <label htmlFor="unlock-passphrase" className="mt-4 mb-1.5 block text-sm font-medium text-white/70">
        Passphrase
      </label>
      <input
        id="unlock-passphrase"
        type="password"
        value={passphrase}
        autoComplete="current-password"
        onChange={(event) => setPassphrase(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && passphrase && !busy) void handleSubmit();
        }}
        className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white focus:border-violet-500 focus:outline-none"
      />

      {error && (
        <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      <p className="mt-3 text-xs leading-relaxed text-white/40">
        Deriving the key takes a moment - that slowness is deliberate, and is what
        makes the stored secret expensive to attack.
      </p>

      <div className="mt-5 flex gap-2">
        <Button
          variant="primary"
          size="lg"
          className="flex-1"
          disabled={!passphrase || busy}
          onClick={handleSubmit}
        >
          <Lock className="h-4 w-4" />
          {busy ? "Unlocking…" : "Unlock"}
        </Button>
        <Button variant="outline" size="lg" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}

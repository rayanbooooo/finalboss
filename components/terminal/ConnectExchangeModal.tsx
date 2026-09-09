"use client";

import { useState } from "react";
import { AlertTriangle, KeyRound, ShieldCheck } from "lucide-react";
import { useExchange } from "@/contexts/ExchangeContext";
import { useToast } from "@/contexts/ToastContext";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface ConnectExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConnectExchangeModal({ isOpen, onClose }: ConnectExchangeModalProps) {
  const { connect } = useExchange();
  const { toast } = useToast();

  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [testnet, setTestnet] = useState(true);
  const [save, setSave] = useState(true);
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = isSupabaseConfigured;
  const passphraseMismatch =
    save && canSave && passphrase.length > 0 && passphrase !== confirmPassphrase;
  const ready =
    apiKey.trim().length > 0 &&
    apiSecret.trim().length > 0 &&
    (!save || !canSave || (passphrase.length >= 8 && passphrase === confirmPassphrase));

  const reset = () => {
    setApiKey("");
    setApiSecret("");
    setPassphrase("");
    setConfirmPassphrase("");
    setError(null);
  };

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      await connect({
        apiKey,
        apiSecret,
        testnet,
        passphrase: save && canSave ? passphrase : undefined,
      });
      toast({
        variant: "success",
        title: testnet ? "Testnet account connected" : "Live account connected",
        description: "Your key was verified and carries no withdrawal permission.",
      });
      reset();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not connect that key.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Connect your exchange account">
      <p className="text-sm leading-relaxed text-white/60">
        Orders are placed on <span className="text-white/80">your own Bybit account</span>.
        This site never holds your funds and never takes a deposit.
      </p>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs leading-relaxed text-emerald-200">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Create the key with <span className="font-semibold">Trade</span> enabled and{" "}
          <span className="font-semibold">Withdraw switched off</span>. A key that can
          withdraw is rejected - that way nothing here, and nobody who breaks into it,
          can move your money off the exchange.
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <NetworkOption
          label="Testnet"
          hint="Fake funds. Start here."
          active={testnet}
          onClick={() => setTestnet(true)}
        />
        <NetworkOption
          label="Live account"
          hint="Real money at risk."
          active={!testnet}
          danger
          onClick={() => setTestnet(false)}
        />
      </div>

      {!testnet && (
        <p className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Orders placed in this mode use real money in your Bybit account. Test on
          testnet first.
        </p>
      )}

      <Field label="API key" value={apiKey} onChange={setApiKey} autoComplete="off" />
      <Field
        label="API secret"
        value={apiSecret}
        onChange={setApiSecret}
        type="password"
        autoComplete="off"
      />

      {canSave && (
        <>
          <label className="mt-5 flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={save}
              onChange={(event) => setSave(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-violet-500"
            />
            <span className="text-sm leading-relaxed text-white/70">
              Remember this key
              <span className="mt-0.5 block text-xs text-white/40">
                Encrypted in your browser with the passphrase below. Leave this off and
                the secret is kept only for this session - nothing is stored at all.
              </span>
            </span>
          </label>

          {save && (
            <>
              <Field
                label="Passphrase"
                value={passphrase}
                onChange={setPassphrase}
                type="password"
                autoComplete="new-password"
                hint="At least 8 characters. Use something different from your account password - that is the point: it means nothing on our servers can decrypt your key."
              />
              <Field
                label="Confirm passphrase"
                value={confirmPassphrase}
                onChange={setConfirmPassphrase}
                type="password"
                autoComplete="new-password"
              />
              {passphraseMismatch && (
                <p className="mt-1.5 text-xs text-rose-300">The passphrases do not match.</p>
              )}
              <p className="mt-2 text-xs leading-relaxed text-white/40">
                There is no way to recover this passphrase. Forget it and you simply
                reconnect the key.
              </p>
            </>
          )}
        </>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-sm leading-relaxed text-rose-200">
          {error}
        </p>
      )}

      <div className="mt-5 flex gap-2">
        <Button
          variant="primary"
          size="lg"
          className="flex-1"
          disabled={!ready || busy}
          onClick={handleSubmit}
        >
          <KeyRound className="h-4 w-4" />
          {busy ? "Verifying…" : "Verify and connect"}
        </Button>
        <Button variant="outline" size="lg" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}

function NetworkOption({
  label,
  hint,
  active,
  danger,
  onClick,
}: {
  label: string;
  hint: string;
  active: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-xl border px-3 py-2.5 text-left transition-colors",
        active
          ? danger
            ? "border-amber-500/50 bg-amber-500/15"
            : "border-emerald-500/50 bg-emerald-500/15"
          : "border-white/10 hover:border-white/20"
      )}
    >
      <span
        className={cn(
          "block text-sm font-medium",
          active ? (danger ? "text-amber-200" : "text-emerald-200") : "text-white/70"
        )}
      >
        {label}
      </span>
      <span className="mt-0.5 block text-xs text-white/40">{hint}</span>
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  hint,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  hint?: string;
  autoComplete?: string;
}) {
  const id = `exchange-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="mt-4">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-white/70">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 font-mono text-sm text-white focus:border-violet-500 focus:outline-none"
      />
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-white/40">{hint}</p>}
    </div>
  );
}

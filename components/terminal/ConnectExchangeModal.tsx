"use client";

import { useState } from "react";
import { AlertTriangle, ExternalLink, KeyRound, ShieldCheck } from "lucide-react";
import { useExchange } from "@/contexts/ExchangeContext";
import { useToast } from "@/contexts/ToastContext";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { isSupabaseConfigured } from "@/lib/supabase";
import { ACTIVE_VENUE, hasReferral, venueSignUpUrl } from "@/lib/venues";
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
        passphrase: save && canSave ? passphrase : undefined,
      });
      toast({
        variant: "success",
        title: "Exchange account connected",
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


      {/* There is no practice mode to fall back on, so this has to be
          unmissable rather than a footnote. */}
      <p className="mt-2 flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs leading-relaxed text-rose-200">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          This connects your real Bybit account. Every order placed on it moves real
          money, starting with the first one. Demo mode is the only place to
          practise, and it does not touch this account.
        </span>
      </p>

      {/* The step that was missing entirely: this screen asked for a Bybit API
          key without ever offering a way to get a Bybit account. Anyone who
          did not already have one had to leave and work it out themselves -
          and every one of them signed up to the exchange with nothing
          attributed to this site. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        <a
          href={venueSignUpUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-violet-300 hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          No {ACTIVE_VENUE.name} account yet? Create one
        </a>
        <a
          href={ACTIVE_VENUE.apiKeyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-white/45 hover:text-white/70"
        >
          <ExternalLink className="h-3 w-3" />
          Where to create the key
        </a>
      </div>

      {hasReferral() && (
        // Said plainly rather than buried in the terms. The link still goes to
        // the same exchange either way, and nobody pays more for using it -
        // but they get to know before they click, not after.
        <p className="mt-1.5 text-[11px] leading-relaxed text-white/35">
          The sign-up link is a referral link: we earn a share of {ACTIVE_VENUE.name}&apos;s
          trading fees if you use it. It costs you nothing extra, and connecting an
          existing account works exactly the same.
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

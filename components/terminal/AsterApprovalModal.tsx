"use client";

import { useState } from "react";
import { Check, ShieldCheck, X } from "lucide-react";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useAsterAgent, type AgentStatus } from "@/hooks/useAsterAgent";
import { APPROVAL_DAYS } from "@/lib/exchange/aster/agent";

interface AsterApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The signed-in account, so two people sharing a browser cannot see each
   *  other's approval. */
  userId: string | null;
}

/** What the user is actually waiting for at each step. Vague progress text on a
 *  flow that includes a wallet prompt is how people end up clicking twice. */
const STATUS_LABEL: Record<Exclude<AgentStatus, "idle">, string> = {
  "switching-chain": "Switching your wallet to BNB Chain…",
  "awaiting-signature": "Waiting for you to sign in your wallet…",
  registering: "Registering with Aster…",
  saving: "Encrypting the trading key…",
};

export function AsterApprovalModal({ isOpen, onClose, userId }: AsterApprovalModalProps) {
  const { agent, ready, status, error, approve, revoke } = useAsterAgent(userId);
  const [passphrase, setPassphrase] = useState("");

  const busy = status !== "idle";

  const handleApprove = async () => {
    await approve(passphrase);
    setPassphrase("");
  };

  if (ready && agent) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Aster is connected">
        <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <div className="text-sm leading-relaxed text-white/70">
            This terminal can place and close perpetual orders on your Aster account.
            It <span className="font-medium text-white">cannot withdraw</span>, and it
            cannot trade spot.
          </div>
        </div>

        <dl className="mt-4 grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 text-sm">
          <div className="grid grid-cols-[110px_1fr] gap-3 bg-[#0b0f14] px-4 py-3">
            <dt className="text-white/40">Trading key</dt>
            <dd className="font-mono text-white/80">…{agent.address.slice(-8)}</dd>
          </div>
          <div className="grid grid-cols-[110px_1fr] gap-3 bg-[#0b0f14] px-4 py-3">
            <dt className="text-white/40">Expires</dt>
            <dd className="text-white/80">
              {new Date(agent.expiresAt).toLocaleDateString()}
            </dd>
          </div>
        </dl>

        <p className="mt-4 text-xs leading-relaxed text-white/40">
          Revoking removes the trading key from this browser. Your funds and your Aster
          account are untouched, and you can approve again at any time. To end the
          authorisation at Aster itself, delete the API wallet in their API management
          page.
        </p>

        <div className="mt-5 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Done
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={() => {
              revoke();
              onClose();
            }}
          >
            Revoke
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Approve trading on Aster">
      <p className="text-sm leading-relaxed text-white/60">
        One signature from your wallet lets this terminal place orders on your Aster
        account. You will not be asked again for {APPROVAL_DAYS} days.
      </p>

      <ul className="mt-4 flex flex-col gap-3">
        <li className="flex items-start gap-3 text-sm leading-relaxed text-white/70">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <span>
            <span className="font-medium text-white">It cannot withdraw.</span> The
            approval grants perpetual trading only — moving funds is not something this
            terminal is able to ask for.
          </span>
        </li>
        <li className="flex items-start gap-3 text-sm leading-relaxed text-white/70">
          <X className="mt-0.5 h-4 w-4 shrink-0 text-white/30" />
          <span>
            <span className="font-medium text-white">Spot trading stays off.</span> This
            is a perpetuals terminal, so it never asks for access it would not use.
          </span>
        </li>
      </ul>

      <label className="mt-5 block text-sm font-medium text-white/70" htmlFor="aster-passphrase">
        Choose a passphrase
      </label>
      <input
        id="aster-passphrase"
        type="password"
        autoComplete="new-password"
        value={passphrase}
        disabled={busy}
        onChange={(event) => setPassphrase(event.target.value)}
        placeholder="Used only in this browser"
        className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-violet-400/50 focus:outline-none focus:ring-1 focus:ring-violet-400/40 disabled:opacity-50"
      />
      <p className="mt-2 text-xs leading-relaxed text-white/40">
        It encrypts the trading key on this device. We never receive it, so if you lose
        it you approve again — nothing else is lost.
      </p>

      {error && (
        <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      {busy && (
        <p className="mt-4 text-sm text-white/50">{STATUS_LABEL[status as Exclude<AgentStatus, "idle">]}</p>
      )}

      <Button className="mt-5 w-full" disabled={busy || !passphrase} onClick={handleApprove}>
        {busy ? "Approving…" : "Approve with wallet"}
      </Button>
    </Modal>
  );
}

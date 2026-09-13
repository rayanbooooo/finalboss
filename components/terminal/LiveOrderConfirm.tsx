"use client";

import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatPrice } from "@/lib/format";
import type { OrderSide } from "@/types/trading";
import { cn } from "@/lib/utils";

export interface LiveOrderDraft {
  symbol: string;
  side: OrderSide;
  qty: number;
  notional: number;
  leverage: number;
  markPrice: number;
  testnet: boolean;
  /** Closing an existing position rather than opening one. */
  reduceOnly?: boolean;
}

interface LiveOrderConfirmProps {
  draft: LiveOrderDraft | null;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * The confirm step every order against a real account goes through.
 *
 * Deliberately not skippable and deliberately not one-click: this is the last
 * screen before someone's own money moves at an exchange, and the quantity
 * shown is the rounded one that will actually be sent, not the one the form
 * computed.
 */
export function LiveOrderConfirm({
  draft,
  busy,
  error,
  onConfirm,
  onClose,
}: LiveOrderConfirmProps) {
  if (!draft) return null;

  const action = draft.reduceOnly
    ? "Close position"
    : draft.side === "long"
      ? "Open long"
      : "Open short";

  return (
    <Modal isOpen onClose={busy ? () => {} : onClose} title={`${action} on Bybit`}>
      <div
        className={cn(
          "rounded-xl border px-3 py-2 text-sm",
          draft.testnet
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
            : "border-rose-500/40 bg-rose-500/10 text-rose-200"
        )}
      >
        {draft.testnet
          ? "Testnet account — this uses Bybit's test funds, not real money."
          : "Real funds. This order executes on your own Bybit account and moves real money."}
      </div>

      <dl className="mt-4 flex flex-col gap-2.5 text-sm">
        <Row label="Market" value={draft.symbol} />
        <Row
          label="Side"
          value={draft.side === "long" ? "Buy / Long" : "Sell / Short"}
          valueClassName={draft.side === "long" ? "text-emerald-400" : "text-rose-400"}
        />
        {/* The rounded figure, because it is the one being sent. Showing the
            unrounded one would mean the confirmation and the order disagree. */}
        <Row label="Quantity" value={`${draft.qty} ${draft.symbol.replace("USDT", "")}`} />
        <Row label="Order value" value={formatCurrency(draft.notional)} />
        {!draft.reduceOnly && <Row label="Leverage" value={`${draft.leverage}x`} />}
        <Row label="Mark price" value={formatPrice(draft.markPrice)} />
        <Row label="Order type" value="Market" />
      </dl>

      {!draft.reduceOnly && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs leading-relaxed text-white/50">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
          {/* The demo engine's liquidation rule is not Bybit's, and showing a
              number from it here would be a made-up figure on the one screen
              where it matters most. */}
          <span>
            Bybit sets the liquidation price for this position and applies its own
            fees. It appears on the position once the order fills. A market order
            fills at the best available price, which may differ from the mark
            price above.
          </span>
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      <div className="mt-5 flex gap-2">
        <Button variant="outline" size="lg" className="flex-1" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant={draft.reduceOnly ? "outline" : draft.side === "long" ? "secondary" : "danger"}
          size="lg"
          className="flex-1"
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? "Sending…" : draft.reduceOnly ? "Close position" : "Confirm order"}
        </Button>
      </div>
    </Modal>
  );
}

function Row({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-white/45">{label}</dt>
      <dd className={cn("font-mono tabular-nums text-white/85", valueClassName)}>{value}</dd>
    </div>
  );
}

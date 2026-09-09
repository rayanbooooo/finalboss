"use client";

import { ArrowDownToLine, ArrowUpFromLine, ExternalLink, Lock, TriangleAlert } from "lucide-react";
import { useTerminal } from "@/contexts/TerminalContext";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const BYBIT_ASSETS_URL = "https://www.bybit.com/user/assets/home";
const BYBIT_TESTNET_ASSETS_URL = "https://testnet.bybit.com/user/assets/home";

/**
 * Account summary in the terminal's right column.
 *
 * In a venue-backed mode the figures come from the exchange and nowhere else:
 * when they aren't available this renders the reason instead of numbers.
 * Falling back to demo figures would put a screen that looks like a real
 * account in front of someone whose real account it isn't.
 */
export function BalancesPanel() {
  const { availableBalance, equity, lockedMargin, openFunding, accountMode, live } =
    useTerminal();
  const unrealised = equity - availableBalance - lockedMargin;

  const badge =
    accountMode === "demo"
      ? { label: "DEMO FUNDS", tone: "border-amber-500/30 bg-amber-500/10 text-amber-200" }
      : accountMode === "testnet"
        ? { label: "TESTNET", tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" }
        : { label: "REAL FUNDS", tone: "border-rose-500/40 bg-rose-500/15 text-rose-200" };

  const showFigures = !live.active || live.ready;

  return (
    <div className="border-t border-white/5 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-white/40">
          Balances
        </span>
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 text-[10px] font-medium",
            badge.tone
          )}
        >
          {badge.label}
        </span>
      </div>

      {showFigures ? (
        <div className="flex flex-col gap-2 text-sm">
          <Row label="Available" value={formatCurrency(availableBalance)} strong />
          <Row label="Margin in use" value={formatCurrency(lockedMargin)} />
          <Row
            label="Unrealised P&L"
            value={formatCurrency(unrealised)}
            valueClassName={unrealised >= 0 ? "text-emerald-400" : "text-rose-400"}
          />
          <div className="mt-1 border-t border-white/5 pt-2">
            <Row label="Account equity" value={formatCurrency(equity)} strong />
          </div>
        </div>
      ) : (
        <LiveUnavailable locked={live.locked} loading={live.loading} error={live.error} />
      )}

      {live.active && live.ready && live.stale && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-200">
          <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
          These figures haven&apos;t refreshed recently and may be out of date.
        </p>
      )}

      {accountMode === "demo" ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <FundingButton icon={ArrowDownToLine} label="Deposit" onClick={() => openFunding("deposit")} />
          <FundingButton icon={ArrowUpFromLine} label="Withdraw" onClick={() => openFunding("withdraw")} />
        </div>
      ) : (
        // Funding a real account happens at the exchange. This site never
        // takes a deposit, so it links out rather than pretending to.
        <a
          href={accountMode === "testnet" ? BYBIT_TESTNET_ASSETS_URL : BYBIT_ASSETS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 text-xs font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Manage funds on Bybit
        </a>
      )}
    </div>
  );
}

function LiveUnavailable({
  locked,
  loading,
  error,
}: {
  locked: boolean;
  loading: boolean;
  error: string | null;
}) {
  if (locked) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs leading-relaxed text-white/55">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Your exchange key is locked. Unlock it in Settings to see this account&apos;s
          real balance.
        </span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs leading-relaxed text-rose-200">
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }
  return (
    <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs text-white/45">
      {loading ? "Loading your exchange balance…" : "Waiting for the exchange…"}
    </p>
  );
}

function FundingButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof ArrowDownToLine;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 text-xs font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function Row({
  label,
  value,
  strong,
  valueClassName,
}: {
  label: string;
  value: string;
  strong?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-white/45">{label}</span>
      <span
        className={cn(
          "font-mono tabular-nums",
          strong ? "font-semibold text-white" : "text-white/85",
          valueClassName
        )}
      >
        {value}
      </span>
    </div>
  );
}

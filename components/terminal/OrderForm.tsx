"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useTerminal } from "@/contexts/TerminalContext";
import { useExchange } from "@/contexts/ExchangeContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useToast } from "@/contexts/ToastContext";
import { useInstrument } from "@/hooks/useInstrument";
import { LeverageSlider } from "@/components/terminal/LeverageSlider";
import {
  LiveOrderConfirm,
  type LiveOrderDraft,
} from "@/components/terminal/LiveOrderConfirm";
import { Button } from "@/components/ui/Button";
import {
  calcBidAsk,
  calcLiquidationPrice,
  calcPositionSize,
  clampLeverage,
  fillPrice,
  liquidationDistancePercent,
  DEMO_LEVERAGE_BOUNDS,
  MIN_LEVERAGE,
  type LeverageBounds,
} from "@/lib/calculations";
import { openLivePosition, sizeOrder } from "@/lib/exchange/orders";
import { MARKETS } from "@/lib/markets";
import { formatCurrency, formatPrice, priceDecimals } from "@/lib/format";
import type { OrderSide } from "@/types/trading";
import { cn } from "@/lib/utils";

const EXECUTED_LABEL_MS = 1200;
const BALANCE_FRACTIONS = [0.25, 0.5, 0.75, 1];

export function OrderForm() {
  const { market, markets, activeMarketId, openPosition, availableBalance, accountMode, live } =
    useTerminal();
  // The book's own top-of-book, shown as reference context above the form.
  const bestBid = market.orderbook.bids[0];
  const bestAsk = market.orderbook.asks[0];
  const { profile } = useOnboarding();
  const { toast } = useToast();
  const { credentials, openUnlock } = useExchange();
  const [side, setSide] = useState<OrderSide>("long");
  const [leverage, setLeverage] = useState(() => clampLeverage(profile?.defaultLeverage ?? MIN_LEVERAGE));
  const [margin, setMargin] = useState(1000);
  const [justExecuted, setJustExecuted] = useState(false);
  const [draft, setDraft] = useState<LiveOrderDraft | null>(null);
  const [sending, setSending] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [sizingError, setSizingError] = useState<string | null>(null);

  const marketConfig = MARKETS.find((m) => m.id === activeMarketId);
  const instrument = useInstrument(marketConfig?.bybitSymbol ?? null, live.active);

  // Demo's 500-1000x exists at no real venue, so a connected account takes its
  // range from the instrument. Sending anything outside it gets the order
  // rejected rather than clamped.
  const bounds: LeverageBounds =
    live.active && instrument
      ? { min: instrument.minLeverage, max: instrument.maxLeverage }
      : DEMO_LEVERAGE_BOUNDS;

  // Switching modes changes the range under a leverage that was valid a moment
  // ago - 750x is fine in demo and impossible on Bybit - so pull it back into
  // range as the bounds change rather than at submit time.
  const [appliedBounds, setAppliedBounds] = useState(bounds);
  if (appliedBounds.min !== bounds.min || appliedBounds.max !== bounds.max) {
    setAppliedBounds(bounds);
    setLeverage((current) => clampLeverage(current, bounds));
  }

  // What demo mode actually fills at: BTC's real price anchors the spread
  // fraction (see BTC_SPREAD_USD), applied to this market's own price. Live
  // mode ignores this entirely - Bybit fills at its own real spread, via its
  // own order book, not this one.
  const btcPrice = markets.BTC?.price ?? market.price;
  const demoSpread = useMemo(() => calcBidAsk(market.price, btcPrice).spread, [market.price, btcPrice]);
  const demoEntryPrice = useMemo(
    () => fillPrice(market.price, btcPrice, side, "open"),
    [market.price, btcPrice, side]
  );

  // Liquidation and size are both anchored to the price the position will
  // actually open at, not the mid - crossing the spread moves entry away from
  // mid before leverage even applies, and at 1000x that is not a rounding
  // error.
  const liquidationPrice = useMemo(
    () => calcLiquidationPrice(demoEntryPrice, leverage, side),
    [demoEntryPrice, leverage, side]
  );
  const size = useMemo(
    () => calcPositionSize(margin, leverage, demoEntryPrice),
    [margin, leverage, demoEntryPrice]
  );

  const exceedsBalance = margin > availableBalance;
  // A venue mode with the key still locked can show the account but not sign
  // for it. That is a prompt to unlock, not a dead form.
  const needsUnlock = live.active && live.locked;
  const awaitingInstrument = live.active && !instrument;

  /**
   * Demo fills immediately; a venue order goes to a confirm step first.
   *
   * The two paths are deliberately separate rather than one with a flag: a
   * fake fill presented as a real one is the worst failure this screen has, so
   * nothing that touches a real account shares code with the simulator.
   */
  const handleExecute = () => {
    if (margin <= 0 || exceedsBalance) return;
    setSizingError(null);

    if (live.active) {
      if (needsUnlock) {
        openUnlock();
        return;
      }
      if (!instrument) return;
      try {
        const { qty, notional } = sizeOrder(margin, leverage, market.price, instrument);
        setOrderError(null);
        setDraft({
          symbol: instrument.symbol,
          side,
          qty,
          notional,
          leverage,
          markPrice: market.price,
        });
      } catch (caught) {
        setSizingError(
          caught instanceof Error ? caught.message : "Could not size that order."
        );
      }
      return;
    }

    openPosition({
      marketId: activeMarketId,
      symbol: market.symbol,
      side,
      leverage,
      margin,
      entryPrice: demoEntryPrice,
    });
    toast({
      variant: "success",
      title: "Order filled",
      description: `${side === "long" ? "Long" : "Short"} ${market.symbol} at ${formatPrice(demoEntryPrice)} with ${leverage}x on ${formatCurrency(margin)} margin.`,
    });
    setJustExecuted(true);
    setTimeout(() => setJustExecuted(false), EXECUTED_LABEL_MS);
  };

  const handleConfirm = async () => {
    const creds = credentials();
    if (!draft || !creds) {
      setOrderError("Your key is locked. Unlock it and try again.");
      return;
    }
    setSending(true);
    setOrderError(null);
    try {
      await openLivePosition(creds, {
        symbol: draft.symbol,
        side: draft.side,
        qty: draft.qty,
        leverage: draft.leverage,
      });
      setDraft(null);
      toast({
        variant: "success",
        title: "Order sent to Bybit",
        description: `${draft.side === "long" ? "Long" : "Short"} ${draft.qty} ${draft.symbol} at ${draft.leverage}x. The position appears once it fills.`,
      });
      // Don't wait out the poll interval to show what just happened.
      live.refresh();
    } catch (caught) {
      setOrderError(
        caught instanceof Error ? caught.message : "The exchange rejected the order."
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white">Place Order</span>
        <span className="rounded-md border border-white/10 px-2 py-0.5 font-mono text-[11px] text-white/50">
          {leverage}x
        </span>
      </div>

      <div data-tour="direction" className="grid grid-cols-2 gap-2 rounded-xl bg-white/5 p-1">
        <button
          type="button"
          onClick={() => setSide("long")}
          className={cn(
            "min-h-11 rounded-lg text-sm font-semibold transition-colors",
            side === "long" ? "bg-emerald-500 text-base-950 shadow-glow-emerald" : "text-white/60"
          )}
        >
          Long
        </button>
        <button
          type="button"
          onClick={() => setSide("short")}
          className={cn(
            "min-h-11 rounded-lg text-sm font-semibold transition-colors",
            side === "short" ? "bg-rose-500 text-white shadow-glow-rose" : "text-white/60"
          )}
        >
          Short
        </button>
      </div>

      {bestBid && bestAsk && (
        <div className="flex items-center justify-between font-mono text-xs">
          <span className="flex items-center gap-1 text-emerald-400">
            <ArrowUp className="h-3 w-3" />
            {formatPrice(bestBid.price)}
          </span>
          <span className="flex items-center gap-1 text-rose-400">
            <ArrowDown className="h-3 w-3" />
            {formatPrice(bestAsk.price)}
          </span>
        </div>
      )}

      <div data-tour="amount">
        <label htmlFor="margin" className="mb-1.5 block text-sm font-medium text-white/70">
          Margin (USDC)
        </label>
        <input
          id="margin"
          type="number"
          min={0}
          value={margin}
          onChange={(event) => setMargin(Number(event.target.value))}
          className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white focus:border-violet-500 focus:outline-none"
        />
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {BALANCE_FRACTIONS.map((fraction) => {
            const value = Math.floor(availableBalance * fraction);
            return (
              <button
                key={fraction}
                type="button"
                disabled={availableBalance <= 0}
                onClick={() => setMargin(value)}
                className={cn(
                  "min-h-8 rounded-lg border text-xs font-medium transition-colors disabled:opacity-40",
                  margin === value && value > 0
                    ? "border-violet-500/50 bg-violet-500/15 text-violet-200"
                    : "border-white/10 text-white/50 hover:border-white/20 hover:text-white/80"
                )}
              >
                {fraction * 100}%
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-xs">
          <span className="text-white/40">Available</span>
          {/* A live account whose balance hasn't loaded is unknown, not zero.
              Rendering $0.00 would read as "this account is empty". */}
          <span className="font-mono tabular-nums text-white/60">
            {live.active && !live.ready ? "—" : formatCurrency(availableBalance)}
          </span>
        </div>
      </div>

      {live.active && (
        <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm leading-relaxed text-rose-200">
          Orders go to your own Bybit account and move real money. Every one is
          confirmed first.
        </p>
      )}

      {sizingError && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {sizingError}
        </p>
      )}

      {exceedsBalance && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          Margin exceeds your available balance of {formatCurrency(availableBalance)}.
        </p>
      )}

      <div data-tour="leverage">
        <LeverageSlider
          leverage={leverage}
          onChange={setLeverage}
          price={market.price}
          bounds={bounds}
        />
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
        <Row label="Position Size" value={`${size.toFixed(4)} ${activeMarketId}`} />
        {live.active ? (
          <Row label="Entry Price" value={formatPrice(market.price)} />
        ) : (
          <Row
            label={`Entry Price (${side === "long" ? "ask" : "bid"})`}
            value={formatPrice(demoEntryPrice)}
            sub={`${formatCurrency(demoSpread, priceDecimals(market.price))} spread crossed on entry`}
          />
        )}
        {live.active ? (
          // The demo engine's liquidation rule is not Bybit's, and this is the
          // single worst number to guess at. Bybit computes it from the whole
          // account and reports it on the position, so say that instead.
          <Row
            label="Liq. Price"
            value="Set by Bybit"
            valueClassName="text-white/50"
            sub="Shown on the position once the order fills"
          />
        ) : (
          <Row
            label="Est. Liq. Price"
            value={formatPrice(liquidationPrice)}
            valueClassName="text-rose-400"
            // Distance is formatted to the price's precision, not its own - a
            // $64 gap on BTC should read $64.47, not $64.469.
            sub={`${formatCurrency(Math.abs(market.price - liquidationPrice), priceDecimals(market.price))} away · ${liquidationDistancePercent(leverage).toFixed(3)}% of price`}
          />
        )}
      </div>

      <Button
        data-tour="submit"
        variant={side === "long" ? "secondary" : "danger"}
        size="lg"
        onClick={handleExecute}
        disabled={
          margin <= 0 ||
          exceedsBalance ||
          (live.active && !needsUnlock && awaitingInstrument)
        }
        className="w-full"
      >
        {needsUnlock
          ? "Unlock your key to trade"
          : awaitingInstrument
            ? "Loading market rules…"
            : justExecuted
              ? "Order Filled"
              : live.active
                ? `${side === "long" ? "Long" : "Short"} ${instrument?.symbol ?? market.symbol} on Bybit`
                : `${side === "long" ? "Long" : "Short"} ${market.symbol}`}
      </Button>

      <LiveOrderConfirm
        draft={draft}
        busy={sending}
        error={orderError}
        onConfirm={handleConfirm}
        onClose={() => {
          setDraft(null);
          setOrderError(null);
        }}
      />
    </div>
  );
}

function Row({
  label,
  value,
  valueClassName,
  sub,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  sub?: string;
}) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-white/50">{label}</span>
      <span className="text-right">
        <span className={cn("block font-mono text-white/85", valueClassName)}>{value}</span>
        {sub && (
          <span className="mt-0.5 block font-mono text-[11px] text-white/40">{sub}</span>
        )}
      </span>
    </div>
  );
}

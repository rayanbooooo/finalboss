"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTerminal } from "@/contexts/TerminalContext";
import { CryptoIcon } from "@/components/ui/CryptoIcon";
import { MARKETS } from "@/lib/markets";
import { formatPrice, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Bybit-style market switcher: the active market's icon/symbol opens a
 * dropdown of every live market (real logo, live price, 24h% and a
 * LIVE/SIMULATED dot each), so a trader can jump markets without leaving
 * the terminal.
 */
export function MarketSelector() {
  const { markets, activeMarketId, setActiveMarketId } = useTerminal();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const activeConfig = MARKETS.find((m) => m.id === activeMarketId) ?? MARKETS[0];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-3 rounded-xl border border-transparent px-2 py-1.5 transition-colors hover:border-white/10 hover:bg-white/5"
      >
        <CryptoIcon symbol={activeConfig.icon} className="h-9 w-9" />
        <span className="flex flex-col items-start">
          <span className="text-sm font-semibold text-white">{activeConfig.symbol}</span>
          <span className="text-xs text-white/40">{activeConfig.name}</span>
        </span>
        <ChevronDown
          className={cn("h-4 w-4 text-white/40 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-30 mt-2 w-[300px] overflow-hidden rounded-xl border border-white/10 bg-base-900/95 shadow-2xl backdrop-blur-xl"
        >
          <div className="grid grid-cols-[1fr_auto] gap-x-2 px-3 py-2 text-[11px] font-medium text-white/40">
            <span>Market</span>
            <span className="text-right">Price / 24h</span>
          </div>
          {MARKETS.map((config) => {
            const snapshot = markets[config.id];
            const positive = snapshot.change24hPct >= 0;
            const active = config.id === activeMarketId;
            return (
              <button
                key={config.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setActiveMarketId(config.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-white/5",
                  active && "bg-white/[0.06]"
                )}
              >
                <span className="flex items-center gap-2.5">
                  <CryptoIcon symbol={config.icon} className="h-7 w-7" />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-white">{config.symbol}</span>
                    <span className="flex items-center gap-1 text-[11px] text-white/40">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          snapshot.isLive ? "bg-emerald-400" : "bg-violet-400"
                        )}
                      />
                      {snapshot.isLive ? "Live" : "Simulated"}
                    </span>
                  </span>
                </span>
                <span className="flex flex-col items-end">
                  <span className="font-mono text-sm text-white/90">
                    {formatPrice(snapshot.price)}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-[11px]",
                      positive ? "text-emerald-400" : "text-rose-400"
                    )}
                  >
                    {formatPercent(snapshot.change24hPct)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

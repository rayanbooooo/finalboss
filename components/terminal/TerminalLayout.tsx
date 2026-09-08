"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2 } from "lucide-react";
import { useTerminal } from "@/contexts/TerminalContext";
import { MarketHeader } from "@/components/terminal/MarketHeader";
import { TradingChart } from "@/components/terminal/TradingChart";
import { ChartControls } from "@/components/terminal/ChartControls";
import { OrderBook } from "@/components/terminal/OrderBook";
import { TradeHistoryTape } from "@/components/terminal/TradeHistoryTape";
import { MarketPanelTabs } from "@/components/terminal/MarketPanelTabs";
import { OrderForm } from "@/components/terminal/OrderForm";
import { PositionsPanel } from "@/components/terminal/PositionsPanel";
import { GlassCard } from "@/components/ui/GlassCard";
import { aggregateCandles, DEFAULT_TIMEFRAME, type Timeframe } from "@/lib/timeframes";
import type { Candle } from "@/types/market";
import type { PositionWithPnl } from "@/hooks/usePositions";

/**
 * Mobile stacks Chart -> Order Book/Trades tabs -> Order Form -> Positions
 * (via the order-* utilities); desktop switches to a 3-column trading-desk
 * grid with a persistent orderbook on the left and trade tape on the right.
 */
export function TerminalLayout() {
  const { market, activeMarketId, openPositions } = useTerminal();
  const [timeframe, setTimeframe] = useState<Timeframe>(DEFAULT_TIMEFRAME);
  const [chartExpanded, setChartExpanded] = useState(false);
  const displayCandles = aggregateCandles(market.candles, timeframe.bucketMs);

  useEffect(() => {
    if (!chartExpanded) return undefined;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setChartExpanded(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [chartExpanded]);

  return (
    <div className="mx-auto max-w-[1600px] px-3 py-4 sm:px-4 lg:px-6">
      <GlassCard className="overflow-hidden">
        <MarketHeader />

        <div className="flex flex-col lg:grid lg:grid-cols-[240px_minmax(0,1fr)_320px]">
          <div className="hidden border-r border-white/5 lg:col-start-1 lg:row-start-1 lg:row-span-2 lg:block">
            <OrderBook />
          </div>

          <div className="order-1 border-b border-white/5 p-3 sm:p-4 lg:order-none lg:col-start-2 lg:row-start-1 lg:border-b-0">
            {!chartExpanded && (
              <ChartPanel
                timeframe={timeframe}
                onTimeframeChange={setTimeframe}
                expanded={false}
                onToggleExpand={() => setChartExpanded(true)}
                candles={displayCandles}
                currentPrice={market.price}
                positions={openPositions}
                seriesKey={`${activeMarketId}:${timeframe.label}`}
              />
            )}
          </div>

          {chartExpanded &&
            createPortal(
              // GlassCard's backdrop-blur establishes a containing block for
              // `position: fixed` descendants, so a fixed overlay nested
              // inside it only fills the card's own box, not the real
              // viewport - portal past it to document.body so this actually
              // covers everything, navbar included.
              <div className="fixed inset-0 z-50 overflow-y-auto bg-base-950 p-4">
                <ChartPanel
                  timeframe={timeframe}
                  onTimeframeChange={setTimeframe}
                  expanded
                  onToggleExpand={() => setChartExpanded(false)}
                  candles={displayCandles}
                  currentPrice={market.price}
                  positions={openPositions}
                  seriesKey={`${activeMarketId}:${timeframe.label}`}
                />
              </div>,
              document.body
            )}

          <div className="order-2 border-b border-white/5 lg:hidden">
            <MarketPanelTabs />
          </div>

          <div className="order-3 border-b border-white/5 lg:order-none lg:col-start-3 lg:row-start-1 lg:border-b-0 lg:border-l lg:border-white/5">
            <OrderForm />
          </div>

          <div className="order-4 lg:order-none lg:col-start-2 lg:row-start-2 lg:border-t lg:border-white/5">
            <PositionsPanel />
          </div>

          <div className="hidden lg:col-start-3 lg:row-start-2 lg:block lg:border-l lg:border-t lg:border-white/5">
            <div className="px-4 pt-3 text-xs font-medium text-white/40">Recent Trades</div>
            <TradeHistoryTape />
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

interface ChartPanelProps {
  timeframe: Timeframe;
  onTimeframeChange: (timeframe: Timeframe) => void;
  expanded: boolean;
  onToggleExpand: () => void;
  candles: Candle[];
  currentPrice: number;
  positions: PositionWithPnl[];
  seriesKey: string;
}

function ChartPanel({
  timeframe,
  onTimeframeChange,
  expanded,
  onToggleExpand,
  candles,
  currentPrice,
  positions,
  seriesKey,
}: ChartPanelProps) {
  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <ChartControls value={timeframe} onChange={onTimeframeChange} />
        <button
          type="button"
          onClick={onToggleExpand}
          aria-label={expanded ? "Exit fullscreen" : "Expand chart"}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"
        >
          {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>
      <TradingChart
        candles={candles}
        currentPrice={currentPrice}
        positions={positions}
        seriesKey={seriesKey}
        heightClassName={expanded ? "h-[calc(100vh-6rem)]" : "h-[420px] sm:h-[560px]"}
      />
    </>
  );
}

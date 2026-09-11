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
import { BalancesPanel } from "@/components/terminal/BalancesPanel";
import { PositionsPanel } from "@/components/terminal/PositionsPanel";
import { GuidedTour } from "@/components/terminal/GuidedTour";
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
  const sourceCandles = timeframe.source === "coarse" ? market.longRangeCandles : market.candles;
  // The data source is part of the series identity. Without it the chart sees
  // "BTC:1m" before and after the feed goes live, decides it is the same
  // dataset, and patches only the last bar - splicing one real candle onto the
  // simulator's history and drawing a vertical spike that never happened.
  const seriesKey = `${activeMarketId}:${timeframe.label}:${market.isLive ? "live" : "sim"}`;
  const displayCandles = aggregateCandles(sourceCandles, timeframe.bucketMs);

  useEffect(() => {
    if (!chartExpanded) return undefined;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setChartExpanded(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [chartExpanded]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <MarketHeader />

      <div className="flex flex-1 flex-col lg:grid lg:min-h-0 lg:grid-cols-[240px_minmax(0,1fr)_320px] lg:grid-rows-[minmax(0,1fr)_minmax(180px,260px)]">
          {/* Book on top, tape underneath - fills the full column height
              instead of leaving the dead space the book alone left behind. */}
          <div className="hidden border-r border-white/5 lg:col-start-1 lg:row-start-1 lg:row-span-2 lg:flex lg:min-h-0 lg:flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <OrderBook />
            </div>
            <div className="flex h-[240px] shrink-0 flex-col border-t border-white/5">
              <div className="shrink-0 px-3 pt-3 text-xs font-medium text-white/40">
                Recent Trades
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <TradeHistoryTape />
              </div>
            </div>
          </div>

          <div className="order-1 flex min-h-0 flex-col border-b border-white/5 p-3 sm:p-4 lg:order-none lg:col-start-2 lg:row-start-1 lg:border-b-0">
            {!chartExpanded && (
              <ChartPanel
                timeframe={timeframe}
                onTimeframeChange={setTimeframe}
                expanded={false}
                onToggleExpand={() => setChartExpanded(true)}
                candles={displayCandles}
                currentPrice={market.price}
                positions={openPositions}
                seriesKey={seriesKey}
              />
            )}
          </div>

          {chartExpanded &&
            createPortal(
              // Portalled to document.body: any backdrop-filter ancestor
              // becomes the containing block for `position: fixed`
              // descendants, which would trap this overlay inside the panel
              // instead of covering the viewport.
              <div className="fixed inset-0 z-50 overflow-y-auto bg-base-950 p-4">
                <ChartPanel
                  timeframe={timeframe}
                  onTimeframeChange={setTimeframe}
                  expanded
                  onToggleExpand={() => setChartExpanded(false)}
                  candles={displayCandles}
                  currentPrice={market.price}
                  positions={openPositions}
                  seriesKey={seriesKey}
                />
              </div>,
              document.body
            )}

          <div className="order-2 border-b border-white/5 lg:hidden">
            <MarketPanelTabs />
          </div>

          {/* Spans both rows so the submit button is reachable without
              scrolling the panel. */}
          <div className="order-3 border-b border-white/5 lg:order-none lg:col-start-3 lg:row-start-1 lg:row-span-2 lg:overflow-y-auto lg:border-b-0 lg:border-l lg:border-white/5">
            <OrderForm />
            <BalancesPanel />
          </div>

          <div className="order-4 lg:order-none lg:col-start-2 lg:row-start-2 lg:overflow-y-auto lg:border-t lg:border-white/5">
            <PositionsPanel />
          </div>
      </div>

      {/* Mounted here rather than in the route layout: the tour points at
          elements that only exist on the trading screen. */}
      {!chartExpanded && <GuidedTour />}
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
        heightClassName={
          expanded ? "h-[calc(100vh-6rem)]" : "h-[420px] sm:h-[560px] lg:h-full"
        }
      />
    </>
  );
}

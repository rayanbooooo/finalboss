"use client";

import { useState } from "react";
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

/**
 * Mobile stacks Chart -> Order Book/Trades tabs -> Order Form -> Positions
 * (via the order-* utilities); desktop switches to a 3-column trading-desk
 * grid with a persistent orderbook on the left and trade tape on the right.
 */
export function TerminalLayout() {
  const { market, activeMarketId, openPositions } = useTerminal();
  const [timeframe, setTimeframe] = useState<Timeframe>(DEFAULT_TIMEFRAME);
  const displayCandles = aggregateCandles(market.candles, timeframe.bucketMs);

  return (
    <div className="mx-auto max-w-[1600px] px-3 py-4 sm:px-4 lg:px-6">
      <GlassCard className="overflow-hidden">
        <MarketHeader />

        <div className="flex flex-col lg:grid lg:grid-cols-[240px_minmax(0,1fr)_320px]">
          <div className="hidden border-r border-white/5 lg:col-start-1 lg:row-start-1 lg:row-span-2 lg:block">
            <OrderBook />
          </div>

          <div className="order-1 border-b border-white/5 p-3 sm:p-4 lg:order-none lg:col-start-2 lg:row-start-1 lg:border-b-0">
            <div className="mb-2 flex items-center justify-between">
              <ChartControls value={timeframe} onChange={setTimeframe} />
            </div>
            <TradingChart
              candles={displayCandles}
              currentPrice={market.price}
              positions={openPositions}
              seriesKey={`${activeMarketId}:${timeframe.label}`}
            />
          </div>

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

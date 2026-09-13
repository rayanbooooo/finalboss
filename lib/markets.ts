import type { CryptoSymbol } from "@/components/ui/CryptoIcon";

export type MarketId = "BTC" | "ETH" | "SOL" | "XRP" | "DOGE";

export interface MarketConfig {
  id: MarketId;
  icon: CryptoSymbol;
  symbol: string;
  name: string;
  coinbaseProductId: string;
  /** Same market at Bybit, used when trading a connected exchange account.
   * Their perpetuals are USDT-settled and named without a separator. */
  bybitSymbol: string;
  /** Where the simulator starts and mean-reverts to when the feed is
   * unreachable. A stale value is what a user actually sees during an outage,
   * so these are refreshed rather than left at whatever they were on day one. */
  seedPrice: number;
}

export const MARKETS: MarketConfig[] = [
  {
    id: "BTC",
    icon: "BTC",
    symbol: "BTC-PERP",
    name: "Bitcoin",
    coinbaseProductId: "BTC-USD",
    bybitSymbol: "BTCUSDT",
    seedPrice: 76800,
  },
  {
    id: "ETH",
    icon: "ETH",
    symbol: "ETH-PERP",
    name: "Ethereum",
    coinbaseProductId: "ETH-USD",
    bybitSymbol: "ETHUSDT",
    seedPrice: 2500,
  },
  {
    id: "SOL",
    icon: "SOL",
    symbol: "SOL-PERP",
    name: "Solana",
    coinbaseProductId: "SOL-USD",
    bybitSymbol: "SOLUSDT",
    seedPrice: 100,
  },
  {
    id: "XRP",
    icon: "XRP",
    symbol: "XRP-PERP",
    name: "XRP",
    coinbaseProductId: "XRP-USD",
    bybitSymbol: "XRPUSDT",
    seedPrice: 1.35,
  },
  {
    id: "DOGE",
    icon: "DOGE",
    symbol: "DOGE-PERP",
    name: "Dogecoin",
    coinbaseProductId: "DOGE-USD",
    bybitSymbol: "DOGEUSDT",
    seedPrice: 0.083,
  },
];

export const DEFAULT_MARKET_ID: MarketId = "BTC";

/** Bybit symbol -> our market id, for mapping positions back from the venue. */
export function marketIdFromBybitSymbol(symbol: string): MarketId | null {
  return MARKETS.find((m) => m.bybitSymbol === symbol)?.id ?? null;
}

export function getMarketConfig(id: MarketId): MarketConfig {
  const found = MARKETS.find((m) => m.id === id);
  if (!found) throw new Error(`Unknown market id: ${id}`);
  return found;
}

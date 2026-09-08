import type { CryptoSymbol } from "@/components/ui/CryptoIcon";

export type MarketId = "BTC" | "ETH" | "SOL" | "XRP" | "DOGE";

export interface MarketConfig {
  id: MarketId;
  icon: CryptoSymbol;
  symbol: string;
  name: string;
  coinbaseProductId: string;
  seedPrice: number;
}

export const MARKETS: MarketConfig[] = [
  {
    id: "BTC",
    icon: "BTC",
    symbol: "BTC-PERP",
    name: "Bitcoin",
    coinbaseProductId: "BTC-USD",
    seedPrice: 68000,
  },
  {
    id: "ETH",
    icon: "ETH",
    symbol: "ETH-PERP",
    name: "Ethereum",
    coinbaseProductId: "ETH-USD",
    seedPrice: 2500,
  },
  {
    id: "SOL",
    icon: "SOL",
    symbol: "SOL-PERP",
    name: "Solana",
    coinbaseProductId: "SOL-USD",
    seedPrice: 145,
  },
  {
    id: "XRP",
    icon: "XRP",
    symbol: "XRP-PERP",
    name: "XRP",
    coinbaseProductId: "XRP-USD",
    seedPrice: 0.55,
  },
  {
    id: "DOGE",
    icon: "DOGE",
    symbol: "DOGE-PERP",
    name: "Dogecoin",
    coinbaseProductId: "DOGE-USD",
    seedPrice: 0.12,
  },
];

export const DEFAULT_MARKET_ID: MarketId = "BTC";

export function getMarketConfig(id: MarketId): MarketConfig {
  const found = MARKETS.find((m) => m.id === id);
  if (!found) throw new Error(`Unknown market id: ${id}`);
  return found;
}

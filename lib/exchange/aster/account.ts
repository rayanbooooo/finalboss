/**
 * Turning Aster's responses into the shapes the terminal already speaks.
 *
 * The UI is written against `LiveBalance`, `LivePosition` and `Instrument` and
 * knows nothing about venues. Everything venue-shaped stops here, which is what
 * lets a second exchange be an adapter rather than a rewrite.
 *
 * Aster's futures API is derived from Binance's, so the field names below are
 * Binance's: `positionAmt` carries direction in its sign, `unRealizedProfit`
 * has that capitalisation, and numbers arrive as strings throughout.
 */

import type { Instrument, LiveBalance, LivePosition } from "@/lib/exchange/types";

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * A field that is genuinely absent rather than zero.
 *
 * Aster sends "0" for a liquidation price that does not exist, and a zero
 * liquidation price rendered in a UI reads as "you are about to be liquidated
 * at $0", which is both alarming and wrong.
 */
function optionalNum(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
}

interface AsterBalanceRow {
  asset?: string;
  balance?: string;
  availableBalance?: string;
  crossUnPnl?: string;
}

/**
 * The USDT balance, in the terminal's shape.
 *
 * `totalEquity` is wallet balance plus unrealised PnL, because that is what
 * Bybit's `totalEquity` means and the UI compares them. Aster reports the two
 * separately, so summing here keeps a number that appears in one place in the
 * interface meaning one thing regardless of venue.
 */
export function parseBalance(rows: unknown): LiveBalance {
  const list = Array.isArray(rows) ? (rows as AsterBalanceRow[]) : [];
  const usdt = list.find((row) => row.asset === "USDT");

  const wallet = num(usdt?.balance);
  const unrealised = num(usdt?.crossUnPnl);

  return {
    coin: "USDT",
    totalEquity: wallet + unrealised,
    availableBalance: num(usdt?.availableBalance),
    unrealisedPnl: unrealised,
  };
}

interface AsterPositionRow {
  symbol?: string;
  positionAmt?: string;
  entryPrice?: string;
  markPrice?: string;
  liquidationPrice?: string;
  leverage?: string;
  isolatedMargin?: string;
  unRealizedProfit?: string;
  updateTime?: number;
}

/**
 * Open positions only.
 *
 * Aster returns every symbol the account has ever touched, including ones with
 * `positionAmt` of zero, so the filter is required rather than defensive -
 * without it the positions table fills with flat rows.
 *
 * Direction lives in the SIGN of `positionAmt`, not in a side field. A short is
 * a negative amount, and the terminal wants a positive size plus a side, so the
 * sign is read once here and the magnitude taken.
 */
export function parsePositions(rows: unknown): LivePosition[] {
  const list = Array.isArray(rows) ? (rows as AsterPositionRow[]) : [];

  return list
    .filter((row) => num(row.positionAmt) !== 0)
    .map((row) => {
      const amount = num(row.positionAmt);
      return {
        symbol: String(row.symbol ?? ""),
        side: amount < 0 ? ("short" as const) : ("long" as const),
        size: Math.abs(amount),
        entryPrice: num(row.entryPrice),
        markPrice: num(row.markPrice),
        liquidationPrice: optionalNum(row.liquidationPrice),
        leverage: num(row.leverage),
        margin: num(row.isolatedMargin),
        unrealisedPnl: num(row.unRealizedProfit),
        openedAt: num(row.updateTime) || Date.now(),
      };
    });
}

interface AsterBracket {
  initialLeverage?: number;
  notionalCap?: number;
}

interface AsterBracketRow {
  symbol?: string;
  brackets?: AsterBracket[];
}

/**
 * The highest leverage a symbol permits.
 *
 * `leverageBracket` answers in TWO shapes: an array of symbols when called
 * without one, and a bare object when called with one. Handling only the array
 * works until the first time the call is narrowed to a symbol, at which point
 * it fails with a type error rather than a venue error and sends you looking in
 * the wrong place entirely.
 *
 * The maximum is taken across brackets because leverage falls as position
 * notional rises - bracket one is the small-position ceiling, which is the
 * number a trader sees on the slider before sizing anything.
 */
export function parseMaxLeverage(response: unknown, symbol?: string): number | null {
  const rows: AsterBracketRow[] = Array.isArray(response)
    ? (response as AsterBracketRow[])
    : response && typeof response === "object"
      ? [response as AsterBracketRow]
      : [];

  const matching = symbol ? rows.filter((row) => row.symbol === symbol) : rows;

  const leverages = matching
    .flatMap((row) => row.brackets ?? [])
    .map((bracket) => bracket.initialLeverage)
    .filter((value): value is number => typeof value === "number" && value > 0);

  return leverages.length > 0 ? Math.max(...leverages) : null;
}

interface AsterFilter {
  filterType?: string;
  tickSize?: string;
  minQty?: string;
  stepSize?: string;
}

interface AsterSymbolInfo {
  symbol?: string;
  filters?: AsterFilter[];
}

function filterOf(info: AsterSymbolInfo, type: string): AsterFilter | undefined {
  return (info.filters ?? []).find((filter) => filter.filterType === type);
}

/**
 * Trading rules for one symbol.
 *
 * Quantity bounds come from MARKET_LOT_SIZE, not LOT_SIZE, and the difference
 * is not cosmetic: this terminal places market orders exclusively, and the two
 * filters can carry different minimums and steps. Sizing against LOT_SIZE and
 * then sending a market order is a rejection that names a quantity the trader
 * can see is within the limit they were shown.
 *
 * LOT_SIZE is the fallback only because a venue that omits MARKET_LOT_SIZE
 * would otherwise yield a zero step, and `roundQtyDown` treats a zero step as
 * "no rounding" and sends the raw quantity straight to the venue.
 *
 * Leverage cannot come from here at all - exchangeInfo carries no leverage - so
 * `maxLeverage` is passed in from `leverageBracket`, and the caller is forced
 * to have fetched it rather than being handed a plausible default.
 */
export function parseInstrument(info: unknown, maxLeverage: number): Instrument {
  const symbolInfo = (info ?? {}) as AsterSymbolInfo;

  const lot = filterOf(symbolInfo, "MARKET_LOT_SIZE") ?? filterOf(symbolInfo, "LOT_SIZE");
  const price = filterOf(symbolInfo, "PRICE_FILTER");

  return {
    symbol: String(symbolInfo.symbol ?? ""),
    // Aster does not publish a minimum leverage; 1 is the floor everywhere.
    minLeverage: 1,
    maxLeverage: maxLeverage > 0 ? maxLeverage : 1,
    // Whole steps only. Aster takes an integer leverage, so an 0.01 step would
    // let the slider offer values the venue rounds or rejects.
    leverageStep: 1,
    minQty: num(lot?.minQty),
    qtyStep: num(lot?.stepSize),
    tickSize: num(price?.tickSize),
  };
}

/** Finds one symbol inside an exchangeInfo response. */
export function findSymbol(exchangeInfo: unknown, symbol: string): unknown {
  const symbols = (exchangeInfo as { symbols?: unknown[] } | null)?.symbols;
  if (!Array.isArray(symbols)) return null;
  return symbols.find((row) => (row as AsterSymbolInfo).symbol === symbol) ?? null;
}

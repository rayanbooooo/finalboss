export function formatCurrency(value: number, decimals = 2): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Sub-$1 markets (XRP, DOGE, ...) need more decimal places than BTC/ETH to show a meaningful price move. */
export function priceDecimals(value: number): number {
  if (value >= 100) return 2;
  if (value >= 1) return 3;
  return 4;
}

export function formatPrice(value: number): string {
  return formatCurrency(value, priceDecimals(value));
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number, decimals = 2): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

export function truncateAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatTimestamp(time: number): string {
  const date = new Date(time);
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

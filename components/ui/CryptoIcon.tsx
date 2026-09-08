export type CryptoSymbol = "BTC" | "ETH" | "SOL" | "XRP" | "DOGE" | "USDC";

interface CryptoIconProps {
  symbol: CryptoSymbol;
  className?: string;
}

/**
 * Small, self-hosted brand-accurate marks for the coins this app trades -
 * no external image requests, no hotlinked logo CDN.
 */
export function CryptoIcon({ symbol, className }: CryptoIconProps) {
  switch (symbol) {
    case "BTC":
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
          <circle cx="16" cy="16" r="16" fill="#F7931A" />
          <path
            fill="#fff"
            d="M22.6 14.03c.32-2.14-1.31-3.29-3.53-4.06l.72-2.88-1.76-.44-.7 2.8c-.46-.12-.94-.22-1.41-.33l.71-2.83-1.76-.44-.72 2.88c-.38-.09-.76-.17-1.12-.26l-2.43-.6-.47 1.88s1.31.3 1.28.32c.71.18.84.65.82 1.02l-.82 3.3c.05.01.11.03.19.06l-.19-.05-1.15 4.63c-.09.22-.31.54-.81.42.02.03-1.28-.32-1.28-.32l-.87 2.02 2.29.57c.43.11.84.22 1.26.33l-.73 2.92 1.75.44.72-2.89c.48.13.94.25 1.4.36l-.72 2.87 1.76.44.73-2.92c3 .57 5.26.34 6.21-2.38.77-2.19-.04-3.45-1.62-4.27 1.15-.27 2.02-1.02 2.25-2.58zm-4.02 5.64c-.55 2.19-4.24 1.01-5.44.71l.97-3.87c1.2.3 5.04.9 4.47 3.16zm.55-5.67c-.5 2-3.58.98-4.58.73l.87-3.5c1 .25 4.23.72 3.71 2.77z"
          />
        </svg>
      );
    case "ETH":
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
          <circle cx="16" cy="16" r="16" fill="#627EEA" />
          <path fill="#fff" fillOpacity=".6" d="M16.5 4v8.87l7.5 3.35z" />
          <path fill="#fff" d="M16.5 4 9 16.22l7.5-3.35z" />
          <path fill="#fff" fillOpacity=".6" d="M16.5 21.97v6.03L24 17.6z" />
          <path fill="#fff" d="M16.5 28v-6.03L9 17.6z" />
          <path fill="#fff" fillOpacity=".2" d="M16.5 20.57l7.5-4.35-7.5-3.34z" />
          <path fill="#fff" fillOpacity=".6" d="M9 16.22l7.5 4.35v-7.69z" />
        </svg>
      );
    case "SOL":
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
          <defs>
            <linearGradient id="sol-g" x1="2" y1="27" x2="30" y2="5" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#00FFA3" />
              <stop offset="1" stopColor="#DC1FFF" />
            </linearGradient>
          </defs>
          <circle cx="16" cy="16" r="16" fill="#141414" />
          <path
            fill="url(#sol-g)"
            d="M9.4 20.1a1 1 0 0 1 .7-.3h13.6c.45 0 .67.54.36.86l-2.7 2.7a1 1 0 0 1-.7.3H6.1c-.45 0-.67-.54-.36-.86z"
          />
          <path
            fill="url(#sol-g)"
            d="M9.4 8.34a1 1 0 0 1 .7-.3h13.6c.45 0 .67.55.36.87l-2.7 2.7a1 1 0 0 1-.7.3H6.1c-.45 0-.67-.55-.36-.87z"
          />
          <path
            fill="url(#sol-g)"
            d="M22.6 14.18a1 1 0 0 0-.7-.3H8.3c-.45 0-.67.55-.36.87l2.7 2.7a1 1 0 0 0 .7.3h13.6c.45 0 .67-.55.36-.87z"
          />
        </svg>
      );
    case "XRP":
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
          <circle cx="16" cy="16" r="16" fill="#0C0C0C" />
          <path
            fill="none"
            stroke="#fff"
            strokeWidth="1.8"
            d="M9 9c2.8 3 4.6 4.6 7 4.6S18.2 12 21 9M9 23c2.8-3 4.6-4.6 7-4.6s4.2 1.6 7 4.6"
          />
          <circle cx="16" cy="16" r="1.6" fill="#fff" />
        </svg>
      );
    case "DOGE":
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
          <circle cx="16" cy="16" r="16" fill="#C2A633" />
          <text
            x="16"
            y="22"
            textAnchor="middle"
            fontFamily="Arial, sans-serif"
            fontWeight="700"
            fontSize="18"
            fill="#fff"
          >
            Ð
          </text>
        </svg>
      );
    case "USDC":
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
          <circle cx="16" cy="16" r="16" fill="#2775CA" />
          <text
            x="16"
            y="21.5"
            textAnchor="middle"
            fontFamily="Arial, sans-serif"
            fontWeight="700"
            fontSize="15"
            fill="#fff"
          >
            $
          </text>
        </svg>
      );
    default:
      return null;
  }
}

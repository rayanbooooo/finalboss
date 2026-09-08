import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/components/providers/Web3Provider";
import { WalletModalProvider } from "@/contexts/WalletModalContext";
import { MarketFeedProvider } from "@/contexts/MarketFeedContext";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { WalletModal } from "@/components/wallet/WalletModal";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-bricolage",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FinalBoss — High-Leverage Perpetuals Trading",
  description:
    "Trade crypto perpetuals with up to 1000x leverage, zero gas fees, and instant settlement.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0f",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${bricolage.variable}`}
    >
      <body className="min-h-screen bg-base-950 font-sans text-white">
        <Web3Provider>
          <OnboardingProvider>
            <MarketFeedProvider>
              <WalletModalProvider>
                <ToastProvider>
                  {children}
                  <WalletModal />
                </ToastProvider>
              </WalletModalProvider>
            </MarketFeedProvider>
          </OnboardingProvider>
        </Web3Provider>
      </body>
    </html>
  );
}

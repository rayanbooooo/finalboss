import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Web3Provider } from "@/components/providers/Web3Provider";
import { WalletModalProvider } from "@/contexts/WalletModalContext";
import { MarketFeedProvider } from "@/contexts/MarketFeedContext";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { WalletModal } from "@/components/wallet/WalletModal";

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
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-base-950 font-sans text-white">
        <Web3Provider>
          <MarketFeedProvider>
            <WalletModalProvider>
              <div className="flex min-h-screen flex-col">
                <Navbar />
                <main className="flex-1">{children}</main>
                <Footer />
              </div>
              <WalletModal />
            </WalletModalProvider>
          </MarketFeedProvider>
        </Web3Provider>
      </body>
    </html>
  );
}

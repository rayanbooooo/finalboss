import type { ReactNode } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PrivacyNotice } from "@/components/layout/PrivacyNotice";

/**
 * Marketing chrome - navbar and footer - belongs to the public pages only.
 * The terminal is an app shell and deliberately renders neither.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <PrivacyNotice />
    </div>
  );
}

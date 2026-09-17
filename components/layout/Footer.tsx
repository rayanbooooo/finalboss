import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

// Only real destinations belong here. Docs/API/Status/socials were dead
// href="#" placeholders - they go back once there's something to link to.
const FOOTER_LINKS: Record<string, { label: string; href: string }[]> = {
  Product: [
    { label: "Trade", href: "/terminal" },
    { label: "Affiliates", href: "/affiliates" },
    { label: "Sign Up", href: "/signup" },
  ],
  Resources: [{ label: "Terms", href: "/terms" }],
};

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-base-950">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" className="flex items-center gap-2 text-white">
              <Logo className="h-8 w-8" />
              <span className="font-bold">FinalBoss</span>
            </Link>
            <p className="mt-3 text-sm text-white/50">
              Ultra-high-leverage perpetuals trading infrastructure.
            </p>
          </div>

          {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
            <div key={heading}>
              <h3 className="text-sm font-semibold text-white">{heading}</h3>
              <ul className="mt-3 space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-white/50 hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-white/5 pt-6">
          {/* This used to end "no real funds, wallets, or trades are involved",
              which stopped being true the moment Real mode could place an order.
              It sat under every page, including the one where a connected Bybit
              key moves real money, and it contradicted the terms page, the
              connect modal's warning and the terminal's own REAL FUNDS badge -
              all of which say the opposite. A disclaimer that under-states the
              risk is worse than none. */}
          <p className="text-xs leading-relaxed text-white/40">
            <strong className="text-white/60">Risk disclaimer:</strong> Trading
            perpetual futures with leverage carries a substantial risk of loss and
            is not suitable for all investors. Leverage of the kind available here can result in
            the total loss of your margin in moments of high volatility. Demo mode
            is simulated and risks nothing; connecting your own exchange account
            means orders execute on that account with real money, starting with
            the first one. Nothing here constitutes financial advice.
          </p>
          <p className="mt-4 text-xs text-white/30">
            © {new Date().getFullYear()} FinalBoss. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

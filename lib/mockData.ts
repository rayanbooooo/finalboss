import type { LucideIcon } from "lucide-react";
import { Crosshair, ShieldCheck, KeyRound, Gauge, LineChart, Users } from "lucide-react";
import type { AffiliateTier } from "@/types/affiliate";

export interface NavLink {
  label: string;
  href: string;
}

export const NAV_LINKS: NavLink[] = [
  { label: "Trade", href: "/terminal" },
  { label: "Affiliates", href: "/affiliates" },
  { label: "Sign Up", href: "/signup" },
];

export interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

/**
 * What this product actually does.
 *
 * Every item here used to describe a different product: a central limit
 * orderbook, off-chain matching "inspired by Orderly Network and Aark",
 * audited infrastructure with on-chain proof of reserves, settlement in
 * milliseconds. None of that exists. There is no matching engine - orders in
 * Real mode are sent to Bybit and filled on Bybit's book - there has been no
 * audit, and there are no reserves to prove because this site holds no funds.
 *
 * The 1000x claim stays, because it is true and it is the product. What went
 * is everything that was decorating it.
 */
export const FEATURES: Feature[] = [
  {
    icon: Gauge,
    title: "Up to 1000x Leverage",
    description:
      "Size a demo position anywhere from 500x to 1000x on one slider, and watch what that does to your liquidation price before you commit to it.",
  },
  {
    icon: LineChart,
    title: "Practice at Real Prices",
    description:
      "Demo mode runs on the same live Bybit feed as a funded account \u2014 same candles, same 24h range, same moves. Only the money is simulated.",
  },
  {
    icon: KeyRound,
    title: "Trade Your Own Account",
    description:
      "Connect an API key and orders go to your own Bybit account, filled on Bybit's book at Bybit's liquidity. We are the interface, not the counterparty.",
  },
  {
    icon: ShieldCheck,
    title: "We Never Hold Your Funds",
    description:
      "There is nothing to deposit here. Keys that can withdraw are rejected at connection time, and a saved secret is encrypted in your browser under a passphrase we never receive.",
  },
  {
    icon: Crosshair,
    title: "Liquidation You Can See Coming",
    description:
      "The liquidation price is on screen before you confirm. At 1000x it sits about 0.065% from entry \u2014 roughly $50 on a $76,000 bitcoin. That is the whole trade.",
  },
  {
    icon: Users,
    title: "Referrals Tracked From Day One",
    description:
      "Share your link and every sign-up through it is attributed to you permanently. No commission is paid yet \u2014 this site charges no trading fees to share \u2014 but referrals made now still count.",
  },
];

export interface HowItWorksStep {
  step: number;
  title: string;
  description: string;
}

export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    step: 1,
    title: "Create your account",
    description:
      "Email and a password, or connect a wallet. It takes a minute and there is nothing to fund.",
  },
  {
    step: 2,
    title: "Start in demo",
    description:
      "You start with demo funds priced off the live Bybit feed. There is nothing to deposit and no balance we hold \u2014 the money is simulated, the market is not.",
  },
  {
    step: 3,
    title: "Choose your leverage",
    description:
      "Dial in anywhere from 500x to 1000x, go long or short, and see the liquidation price move as you do it.",
  },
  {
    step: 4,
    title: "Trade and manage risk",
    description:
      "Track positions, PnL and liquidation live, and close whenever you want. When you are ready for real money, connect your own exchange account.",
  },
];

/**
 * The PLANNED commission ladder, not an active payout.
 *
 * Nothing here pays out today: FinalBoss charges no trading fees, so there is
 * no revenue to take a share of, and no payout rail exists. The perks used to
 * promise "Monthly payouts in USDC" and a "Dedicated account manager", which
 * the signed-in dashboard then contradicted with "Commission earned $0.00".
 * Every string below now describes either something that is true today
 * (referral tracking) or something explicitly marked as planned.
 */
export const AFFILIATE_TIERS: AffiliateTier[] = [
  {
    id: "bronze",
    name: "Bronze",
    requirement: "0 - 10 referrals",
    commissionPct: 20,
    perks: [
      "Referrals tracked from your first link",
      "Live referral dashboard",
      "Planned: 20% share of fee revenue",
    ],
  },
  {
    id: "silver",
    name: "Silver",
    requirement: "11 - 50 referrals",
    commissionPct: 30,
    perks: [
      "Everything in Bronze",
      "Planned: 30% share of fee revenue",
      "Planned: custom referral codes",
    ],
    recommended: true,
  },
  {
    id: "gold",
    name: "Gold",
    requirement: "51+ referrals",
    commissionPct: 40,
    perks: [
      "Everything in Silver",
      "Planned: 40% share of fee revenue",
      "Planned: co-marketing support",
    ],
  },
];

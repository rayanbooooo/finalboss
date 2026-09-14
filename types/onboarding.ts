export type OnboardingMethod = "wallet" | "email";
export type ExperienceLevel = "new" | "some" | "experienced";
export type RiskTolerance = "conservative" | "moderate" | "aggressive";

export interface OnboardingProfile {
  method: OnboardingMethod;
  /** Only present when method === "email". */
  email?: string;
  displayName: string;
  /** Optional linked wallet address. Not an identity and never gated on -
   * the account is the email. See components/terminal/LinkedWallet.tsx. */
  walletAddress?: string;
  experienceLevel: ExperienceLevel;
  riskTolerance: RiskTolerance;
  defaultLeverage: number;
  createdAt: number;
}

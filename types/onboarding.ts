export type OnboardingMethod = "wallet" | "email";
export type ExperienceLevel = "new" | "some" | "experienced";
export type RiskTolerance = "conservative" | "moderate" | "aggressive";

export interface OnboardingProfile {
  method: OnboardingMethod;
  /** Only present when method === "email". */
  email?: string;
  displayName: string;
  experienceLevel: ExperienceLevel;
  riskTolerance: RiskTolerance;
  defaultLeverage: number;
  createdAt: number;
}

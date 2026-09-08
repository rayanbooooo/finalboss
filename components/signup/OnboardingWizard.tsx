"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail } from "lucide-react";
import { useAccount } from "wagmi";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { StepProgress } from "@/components/ui/StepProgress";
import { LeverageSlider } from "@/components/terminal/LeverageSlider";
import { SuccessState } from "@/components/signup/SuccessState";
import { useWalletModal } from "@/contexts/WalletModalContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { truncateAddress } from "@/lib/format";
import type { ExperienceLevel, OnboardingMethod, RiskTolerance } from "@/types/onboarding";
import { cn } from "@/lib/utils";

const METHOD_TABS = [
  { value: "wallet", label: "Web3 Wallet" },
  { value: "email", label: "Email" },
];

const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string }[] = [
  { value: "new", label: "New to trading" },
  { value: "some", label: "Some experience" },
  { value: "experienced", label: "Experienced" },
];

const RISK_OPTIONS: { value: RiskTolerance; label: string }[] = [
  { value: "conservative", label: "Conservative" },
  { value: "moderate", label: "Moderate" },
  { value: "aggressive", label: "Aggressive" },
];

const STEP_LABELS = ["Method", "Profile", "Risk & Preferences", "Review"];
const TOTAL_STEPS = 4;
const SUBMIT_DELAY_MS = 1400;
const REDIRECT_DELAY_MS = 1600;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [method, setMethod] = useState<OnboardingMethod>("wallet");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(null);
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance | null>(null);
  const [defaultLeverage, setDefaultLeverage] = useState(10);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const { isConnected, address } = useAccount();
  const { open: openWalletModal } = useWalletModal();
  const { markOnboarded } = useOnboarding();

  const [prevIsConnected, setPrevIsConnected] = useState(isConnected);
  if (isConnected !== prevIsConnected) {
    setPrevIsConnected(isConnected);
    if (step === 1 && method === "wallet" && isConnected) {
      setStep(2);
    }
  }

  useEffect(() => {
    if (!done) return undefined;
    const timeout = setTimeout(() => {
      router.push("/terminal");
    }, REDIRECT_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [done, router]);

  if (done) {
    return <SuccessState />;
  }

  const handleEmailContinue = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!EMAIL_PATTERN.test(email)) return;
    setStep(2);
  };

  const handleSubmit = () => {
    if (!agreed || !displayName.trim() || !experienceLevel || !riskTolerance) return;
    setSubmitting(true);
    setTimeout(() => {
      markOnboarded({
        method,
        email: method === "email" ? email : undefined,
        displayName: displayName.trim(),
        experienceLevel,
        riskTolerance,
        defaultLeverage,
        createdAt: Date.now(),
      });
      setSubmitting(false);
      setDone(true);
    }, SUBMIT_DELAY_MS);
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <StepProgress currentStep={step} totalSteps={TOTAL_STEPS} label={STEP_LABELS[step - 1]} />

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <Tabs
            items={METHOD_TABS}
            value={method}
            onChange={(value) => setMethod(value as OnboardingMethod)}
            className="w-full"
          />

          {method === "wallet" ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-white/55">
                Connect a Web3 wallet to create your account instantly — no email or
                password required.
              </p>
              <Button variant="primary" size="lg" onClick={openWalletModal} className="w-full">
                Connect Wallet
              </Button>
            </div>
          ) : (
            <form onSubmit={handleEmailContinue} className="flex flex-col gap-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-white/70">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-white/30 focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={!EMAIL_PATTERN.test(email)}
                className="w-full"
              >
                Continue
              </Button>
            </form>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-5">
          <div>
            <label
              htmlFor="displayName"
              className="mb-1.5 block text-sm font-medium text-white/70"
            >
              Display name
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="e.g. Alex"
              className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/30 focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-white/70">
              Trading experience
            </span>
            <div className="grid grid-cols-3 gap-2">
              {EXPERIENCE_OPTIONS.map((option) => (
                <SegmentButton
                  key={option.value}
                  label={option.label}
                  active={experienceLevel === option.value}
                  onClick={() => setExperienceLevel(option.value)}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            {method !== "wallet" && (
              <Button variant="outline" size="lg" onClick={() => setStep(1)} className="w-full">
                Back
              </Button>
            )}
            <Button
              variant="primary"
              size="lg"
              disabled={!displayName.trim() || !experienceLevel}
              onClick={() => setStep(3)}
              className="w-full"
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-5">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-white/70">
              Risk tolerance
            </span>
            <div className="grid grid-cols-3 gap-2">
              {RISK_OPTIONS.map((option) => (
                <SegmentButton
                  key={option.value}
                  label={option.label}
                  active={riskTolerance === option.value}
                  onClick={() => setRiskTolerance(option.value)}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm text-white/55">
              Choose a starting leverage — you can change this on every trade later.
            </p>
            <LeverageSlider leverage={defaultLeverage} onChange={setDefaultLeverage} />
          </div>

          <div className="flex gap-3">
            <Button variant="outline" size="lg" onClick={() => setStep(2)} className="w-full">
              Back
            </Button>
            <Button
              variant="primary"
              size="lg"
              disabled={!riskTolerance}
              onClick={() => setStep(4)}
              className="w-full"
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
            <SummaryRow
              label="Sign-in method"
              value={method === "wallet" ? (address ? truncateAddress(address) : "Wallet") : email}
            />
            <SummaryRow label="Display name" value={displayName} />
            <SummaryRow
              label="Experience"
              value={EXPERIENCE_OPTIONS.find((o) => o.value === experienceLevel)?.label ?? "—"}
            />
            <SummaryRow
              label="Risk tolerance"
              value={RISK_OPTIONS.find((o) => o.value === riskTolerance)?.label ?? "—"}
            />
            <SummaryRow label="Default leverage" value={`${defaultLeverage}x`} />
          </div>

          <label className="flex items-start gap-3 text-sm text-white/55">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-white/20 bg-white/5 text-violet-600 focus:ring-violet-500"
            />
            <span>
              I agree to the{" "}
              <Link
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-300 hover:underline"
              >
                Terms of Service
              </Link>{" "}
              and acknowledge the risks of high-leverage trading.
            </span>
          </label>

          <div className="flex gap-3">
            <Button variant="outline" size="lg" onClick={() => setStep(3)} className="w-full">
              Back
            </Button>
            <Button
              variant="primary"
              size="lg"
              disabled={!agreed || submitting}
              onClick={handleSubmit}
              className="w-full"
            >
              {submitting ? <Spinner className="h-5 w-5" /> : "Create Account"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SegmentButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-xl border px-2 text-xs font-medium transition-colors",
        active
          ? "border-violet-500/50 bg-violet-500/15 text-violet-200"
          : "border-white/10 text-white/50 hover:border-white/20 hover:text-white/80"
      )}
    >
      {label}
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-white/50">{label}</span>
      <span className="truncate text-right font-medium text-white/85">{value}</span>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, RotateCcw } from "lucide-react";
import { TOUR_STORAGE_KEY } from "@/components/terminal/GuidedTour";
import { ExchangePanel } from "@/components/terminal/ExchangePanel";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useToast } from "@/contexts/ToastContext";
import { LeverageSlider } from "@/components/terminal/LeverageSlider";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { clampLeverage, MIN_LEVERAGE } from "@/lib/calculations";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { ExperienceLevel, RiskTolerance } from "@/types/onboarding";
import { cn } from "@/lib/utils";

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

export function SettingsPanel() {
  const { profile, userId, isResolved, updateProfile, signOut } = useOnboarding();
  const { toast } = useToast();
  const router = useRouter();

  const replayTour = () => {
    try {
      window.localStorage.removeItem(TOUR_STORAGE_KEY);
    } catch {
      // The tour runs whenever the flag is absent, so a blocked store is fine.
    }
    router.push("/terminal");
  };

  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(
    profile?.experienceLevel ?? "some"
  );
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>(
    profile?.riskTolerance ?? "moderate"
  );
  const [defaultLeverage, setDefaultLeverage] = useState(clampLeverage(profile?.defaultLeverage ?? MIN_LEVERAGE));
  const [saving, setSaving] = useState(false);

  // The profile can arrive after first render (the Supabase fetch resolves
  // later), so the fields have to re-seed when it does or they'd stay stuck
  // on the empty defaults they were initialised with.
  const [syncedProfile, setSyncedProfile] = useState(profile);
  if (profile !== syncedProfile) {
    setSyncedProfile(profile);
    setDisplayName(profile?.displayName ?? "");
    setExperienceLevel(profile?.experienceLevel ?? "some");
    setRiskTolerance(profile?.riskTolerance ?? "moderate");
    setDefaultLeverage(clampLeverage(profile?.defaultLeverage ?? MIN_LEVERAGE));
  }

  if (!isResolved) {
    return (
      <div className="mx-auto flex w-full max-w-2xl justify-center py-16">
        <Spinner className="h-7 w-7 text-white/40" />
      </div>
    );
  }

  // Reachable with a wallet-only session: that passes the terminal gate but
  // never creates a profile. Rendering nothing here just looked broken.
  if (!profile) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="text-xl font-semibold text-white">Settings</h1>
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <p className="text-sm leading-relaxed text-white/60">
            This session is signed in with a wallet and has no account profile
            yet, so there are no preferences to edit. Create one to set a
            display name, risk tolerance and a default leverage.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/signup" className={cn(buttonVariants("primary", "lg"))}>
              Create a profile
            </Link>
            <Button variant="outline" size="lg" onClick={signOut}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const dirty =
    displayName.trim() !== profile.displayName ||
    experienceLevel !== profile.experienceLevel ||
    riskTolerance !== profile.riskTolerance ||
    defaultLeverage !== profile.defaultLeverage;

  const handleSave = async () => {
    if (!displayName.trim()) return;
    setSaving(true);
    await updateProfile({
      displayName: displayName.trim(),
      experienceLevel,
      riskTolerance,
      defaultLeverage,
    });
    setSaving(false);
    toast({ variant: "success", title: "Settings saved" });
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="text-xl font-semibold text-white">Settings</h1>
      <p className="mt-1 text-sm text-white/50">
        {userId
          ? "Saved to your account, so these follow you to any device."
          : isSupabaseConfigured
            ? "Stored in this browser. Sign in to have them follow your account."
            : "Stored in this browser - no backend is connected on this deployment."}
      </p>

      <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="text-sm font-semibold text-white">Profile</h2>

        <label htmlFor="displayName" className="mt-4 mb-1.5 block text-sm font-medium text-white/70">
          Display name
        </label>
        <input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white focus:border-violet-500 focus:outline-none"
        />

        {profile.email && (
          <div className="mt-4">
            <span className="mb-1.5 block text-sm font-medium text-white/70">Email</span>
            <p className="font-mono text-sm text-white/50">{profile.email}</p>
          </div>
        )}

        <span className="mt-5 mb-1.5 block text-sm font-medium text-white/70">
          Trading experience
        </span>
        <div className="grid grid-cols-3 gap-2">
          {EXPERIENCE_OPTIONS.map((option) => (
            <Segment
              key={option.value}
              label={option.label}
              active={experienceLevel === option.value}
              onClick={() => setExperienceLevel(option.value)}
            />
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="text-sm font-semibold text-white">Trading preferences</h2>

        <span className="mt-4 mb-1.5 block text-sm font-medium text-white/70">Risk tolerance</span>
        <div className="grid grid-cols-3 gap-2">
          {RISK_OPTIONS.map((option) => (
            <Segment
              key={option.value}
              label={option.label}
              active={riskTolerance === option.value}
              onClick={() => setRiskTolerance(option.value)}
            />
          ))}
        </div>

        <p className="mt-5 mb-2 text-sm text-white/55">
          Default leverage, used as the starting value on every new order.
        </p>
        <LeverageSlider leverage={defaultLeverage} onChange={setDefaultLeverage} />
      </section>

      <ExchangePanel />

      <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="text-sm font-semibold text-white">Walkthrough</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-white/55">
          Replay the guided tour of the trading screen - direction, margin,
          leverage, placing and closing a position.
        </p>
        <Button variant="outline" size="lg" className="mt-4" onClick={replayTour}>
          <RotateCcw className="h-4 w-4" />
          Replay walkthrough
        </Button>
      </section>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button variant="primary" size="lg" onClick={handleSave} disabled={!dirty || saving}>
          {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </Button>
        <Button variant="outline" size="lg" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}

function Segment({
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
      aria-pressed={active}
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

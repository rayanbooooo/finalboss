"use client";

import { LogOut } from "lucide-react";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useSignOut } from "@/hooks/useSignOut";

/**
 * Shown when a user is onboarded via the local profile (email signup, no
 * wallet) - parallel to ConnectedBadge, but violet-accented so it reads
 * distinctly from a real wallet connection.
 */
export function AccountBadge() {
  const { profile } = useOnboarding();
  const { signOut, signingOut } = useSignOut();

  if (!profile) return null;

  return (
    <div className="flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2">
      <span className="h-2 w-2 animate-pulse-glow rounded-full bg-violet-400" />
      <span className="max-w-[10ch] truncate font-mono text-sm text-violet-200">
        {profile.displayName}
      </span>
      <button
        type="button"
        onClick={signOut}
        disabled={signingOut}
        // Named for what it does rather than for the glyph: this ends the
        // FinalBoss session, which is a different thing from the wallet badge's
        // disconnect sitting next to it.
        aria-label="Sign out of FinalBoss"
        title="Sign out"
        className="ml-1 flex h-7 w-7 items-center justify-center rounded-full text-violet-300/70 hover:bg-violet-500/20 hover:text-violet-200 disabled:opacity-50"
      >
        <LogOut className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

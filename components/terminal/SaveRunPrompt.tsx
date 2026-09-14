"use client";

import { useState } from "react";
import Link from "next/link";
import { Save, X } from "lucide-react";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useTerminal } from "@/contexts/TerminalContext";
import { buttonVariants } from "@/components/ui/Button";
import { authLink } from "@/lib/navigation";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import { cn } from "@/lib/utils";

/**
 * The one place this site asks a stranger for an email.
 *
 * It waits until their first position has actually closed or liquidated,
 * because that is the moment the pitch is true and felt rather than claimed:
 * they have just watched what 1000x does, and the thing on offer is keeping it.
 * Asking earlier - which is what a signup wall does - asks someone to pay a
 * price before they have seen anything worth paying for.
 *
 * usePositions adopts the run into the account on first sign-in, so the offer
 * below is literal. If that ever stops being true this component has to go with
 * it, because then it would be selling something that does not happen.
 */
export function SaveRunPrompt() {
  const { isOnboarded, isResolved } = useOnboarding();
  const { history } = useTerminal();

  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEYS.saveRunDismissed) === "true";
    } catch {
      // Storage blocked: show it once this session rather than never.
      return false;
    }
  });

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_KEYS.saveRunDismissed, "true");
    } catch {
      // Not persisting only means it appears again next visit.
    }
  };

  // Deliberately every condition, in the order they become knowable: nothing
  // renders until auth has settled, so a returning user never sees a flash of
  // "create an account".
  if (!isResolved || isOnboarded || dismissed || history.length === 0) return null;

  const closed = history.length;

  return (
    <div className="border-t border-violet-500/20 bg-violet-500/[0.07] px-4 py-3 sm:px-5">
      <div className="mx-auto flex max-w-5xl items-start gap-3">
        <Save className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">
            That&apos;s {closed} closed position{closed === 1 ? "" : "s"}. Want to keep
            {closed === 1 ? " it" : " them"}?
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-white/55">
            An account saves your history across devices and gives you a referral
            link. Your demo run comes with you &mdash; nothing to deposit, and the
            trades stay simulated.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={authLink("/signup", "/terminal")}
            className={cn(buttonVariants("primary", "md"), "whitespace-nowrap")}
          >
            Save my history
          </Link>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

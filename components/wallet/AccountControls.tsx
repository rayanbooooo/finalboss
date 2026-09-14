"use client";

import Link from "next/link";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { buttonVariants } from "@/components/ui/Button";
import { AccountBadge } from "@/components/wallet/AccountBadge";
import { authLink } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/**
 * One identity, shown once.
 *
 * This used to render the wallet chip and the account chip side by side, which
 * is exactly what a header looked like for anyone both signed in and
 * wallet-connected: two addresses for one person, each with its own sign-out
 * button that did something different. They were shown together because they
 * genuinely were two separate identities - which was the underlying problem,
 * not a display bug.
 *
 * A wallet is no longer an identity. It is an optional detail on an account,
 * linked and unlinked in Settings, so nothing about it belongs in a header.
 *
 * The signed-out call to action was also "Connect Wallet", which asked a
 * stranger for the one thing that creates no account at all. It is now the
 * thing that does.
 */
export function AccountControls({
  size = "md",
  className,
}: {
  size?: "md" | "lg";
  className?: string;
}) {
  const { isOnboarded, profile } = useOnboarding();

  if (!isOnboarded) {
    return (
      <Link
        href={authLink("/signin", "/terminal")}
        className={cn(
          buttonVariants("outline", size),
          size === "lg" && "w-full",
          className
        )}
      >
        Sign in
      </Link>
    );
  }

  // `isOnboarded` can be true for a moment before the profile row lands, so
  // this is not an "or" with the branch above - there is simply nothing to
  // name yet.
  if (!profile) return null;

  return (
    <div className={cn("flex items-center", className)}>
      <AccountBadge />
    </div>
  );
}

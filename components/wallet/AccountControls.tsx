"use client";

import { useAccount } from "wagmi";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useWalletModal } from "@/contexts/WalletModalContext";
import { Button } from "@/components/ui/Button";
import { ConnectedBadge } from "@/components/wallet/ConnectedBadge";
import { AccountBadge } from "@/components/wallet/AccountBadge";
import { cn } from "@/lib/utils";

/**
 * The wallet and account chrome, decided once for every header that shows it.
 *
 * The three call sites each used to pick a single badge with
 * `isConnected ? <ConnectedBadge/> : profile ? <AccountBadge/> : <Connect/>`,
 * which meant a user who was both signed in and wallet-connected saw only the
 * wallet badge - whose button disconnects the wallet and leaves the FinalBoss
 * session untouched. In that state the app rendered no way to sign out at all.
 * They are separate things, so both are shown when both apply.
 */
export function AccountControls({
  size = "md",
  className,
}: {
  size?: "md" | "lg";
  className?: string;
}) {
  const { isConnected } = useAccount();
  const { profile } = useOnboarding();
  const { open: openWalletModal } = useWalletModal();

  if (!isConnected && !profile) {
    return (
      <Button
        variant="outline"
        size={size}
        onClick={openWalletModal}
        className={cn(size === "lg" && "w-full", className)}
      >
        Connect Wallet
      </Button>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {isConnected && <ConnectedBadge />}
      {profile && <AccountBadge />}
    </div>
  );
}

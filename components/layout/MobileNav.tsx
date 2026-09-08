"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useAccount } from "wagmi";
import { NAV_LINKS } from "@/lib/mockData";
import { useWalletModal } from "@/contexts/WalletModalContext";
import { Button, buttonVariants } from "@/components/ui/Button";
import { ConnectedBadge } from "@/components/wallet/ConnectedBadge";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const { isConnected } = useAccount();
  const { open: openWalletModal } = useWalletModal();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className="absolute right-0 top-0 flex h-full w-[85%] max-w-sm animate-slide-in-right flex-col gap-6 border-l border-white/10 bg-base-900 p-6"
      >
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-white">Menu</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-white/70 hover:bg-white/10"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              className="min-h-11 rounded-lg px-3 py-3 text-base font-medium text-white/80 hover:bg-white/5 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-3">
          {isConnected ? (
            <ConnectedBadge />
          ) : (
            <Button variant="outline" size="lg" onClick={openWalletModal} className="w-full">
              Connect Wallet
            </Button>
          )}
          <Link
            href="/terminal"
            onClick={onClose}
            className={cn(buttonVariants("primary", "lg"), "w-full")}
          >
            Start Trading
          </Link>
        </div>
      </div>
    </div>
  );
}

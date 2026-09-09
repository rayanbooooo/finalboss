import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "violet" | "emerald" | "amber" | "rose" | "neutral";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  violet: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  // Caution rather than error - "real money is at stake here", not "this failed".
  amber: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  rose: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  neutral: "bg-white/10 text-white/70 border-white/15",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ variant = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        VARIANT_CLASSES[variant],
        className
      )}
      {...props}
    />
  );
}

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-violet-600 text-white hover:bg-violet-500 shadow-glow-violet",
  secondary: "bg-emerald-500 text-base-950 hover:bg-emerald-400 shadow-glow-emerald",
  outline: "border border-white/15 text-white hover:bg-white/5",
  ghost: "text-white/80 hover:bg-white/5 hover:text-white",
  danger: "bg-rose-500 text-white hover:bg-rose-400 shadow-glow-rose",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-7 text-base",
};

export function buttonVariants(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md"
) {
  return cn(
    "inline-flex min-w-11 items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size]
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants(variant, size), className)} {...props} />
  )
);
Button.displayName = "Button";

import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

/** Custom mark - three ascending bars on a solid dark chip, no gradient fill. */
export function Logo({ className }: LogoProps) {
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-base-900",
        className
      )}
    >
      <svg viewBox="0 0 32 32" className="h-[55%] w-[55%]" aria-hidden="true">
        <rect x="6" y="18" width="5" height="8" rx="1.5" fill="#C9A65B" />
        <rect x="13.5" y="11" width="5" height="15" rx="1.5" fill="#C9A65B" />
        <rect x="21" y="6" width="5" height="20" rx="1.5" fill="#C9A65B" />
      </svg>
    </span>
  );
}

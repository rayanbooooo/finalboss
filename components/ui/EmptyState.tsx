import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center sm:px-6">
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
        <Icon className="h-5 w-5 text-white/35" />
      </span>
      <p className="mt-3 text-sm font-medium text-white/80">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm leading-relaxed text-white/40">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

"use client";

import { cn } from "@/lib/utils";

export interface TabItem {
  value: string;
  label: string;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function Tabs({ items, value, onChange, className }: TabsProps) {
  return (
    <div className={cn("inline-flex rounded-xl bg-white/5 p-1", className)} role="tablist">
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "min-h-9 min-w-11 rounded-lg px-4 text-sm font-medium transition-colors",
              active
                ? "bg-violet-600 text-white shadow-glow-violet"
                : "text-white/60 hover:text-white"
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

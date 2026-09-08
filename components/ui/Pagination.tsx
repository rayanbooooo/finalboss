"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  pageCount: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

/**
 * Page numbers with the middle collapsed to an ellipsis, so the control
 * stays a fixed width however many pages there are.
 */
function pageItems(page: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);

  const items: (number | "gap")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);

  if (start > 2) items.push("gap");
  for (let i = start; i <= end; i += 1) items.push(i);
  if (end < pageCount - 1) items.push("gap");
  items.push(pageCount);
  return items;
}

export function Pagination({
  page,
  pageCount,
  totalItems,
  pageSize,
  onPageChange,
}: PaginationProps) {
  if (pageCount <= 1) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-4 py-3 sm:px-6">
      <p className="text-xs text-white/40">
        Showing <span className="text-white/70">{first}</span> to{" "}
        <span className="text-white/70">{last}</span> of{" "}
        <span className="text-white/70">{totalItems}</span> results
      </p>

      <div className="flex items-center gap-1">
        <PageButton
          label="Previous page"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </PageButton>

        {pageItems(page, pageCount).map((item, index) =>
          item === "gap" ? (
            <span
              key={`gap-${index}`}
              className="px-1.5 text-xs text-white/30"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <PageButton
              key={item}
              label={`Page ${item}`}
              active={item === page}
              onClick={() => onPageChange(item)}
            >
              {item}
            </PageButton>
          )
        )}

        <PageButton
          label="Next page"
          disabled={page === pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </PageButton>
      </div>
    </div>
  );
}

function PageButton({
  children,
  label,
  active,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 font-mono text-xs transition-colors",
        active
          ? "border-violet-500/50 bg-violet-500/15 text-violet-200"
          : "border-white/10 text-white/50 hover:border-white/20 hover:text-white/80",
        disabled && "pointer-events-none opacity-30"
      )}
    >
      {children}
    </button>
  );
}

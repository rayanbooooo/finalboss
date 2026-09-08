"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: (toast: Omit<Toast, "id">) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DISMISS_AFTER_MS = 5000;
const MAX_VISIBLE = 4;

const VARIANTS: Record<ToastVariant, { icon: typeof CheckCircle2; className: string }> = {
  success: { icon: CheckCircle2, className: "text-emerald-400" },
  error: { icon: XCircle, className: "text-rose-400" },
  warning: { icon: AlertTriangle, className: "text-amber-400" },
  info: { icon: Info, className: "text-violet-300" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((next: Omit<Toast, "id">) => {
    const entry: Toast = { ...next, id: crypto.randomUUID() };
    setToasts((prev) => [entry, ...prev].slice(0, MAX_VISIBLE));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== entry.id));
    }, DISMISS_AFTER_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Portalled to body: a backdrop-filter ancestor would become the
          containing block for this fixed stack and trap it inside a panel.
          Only rendered once a toast exists, which is always client-side, so
          document is defined and there's nothing to mismatch on hydration. */}
      {toasts.length > 0 &&
        createPortal(
          <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
            {toasts.map((entry) => {
              const { icon: Icon, className } = VARIANTS[entry.variant];
              return (
                <div
                  key={entry.id}
                  role="status"
                  className="pointer-events-auto flex animate-fade-in items-start gap-3 rounded-xl border border-white/10 bg-base-850/95 p-3.5 shadow-2xl backdrop-blur-xl"
                >
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", className)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">{entry.title}</p>
                    {entry.description && (
                      <p className="mt-0.5 text-xs leading-relaxed text-white/55">
                        {entry.description}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(entry.id)}
                    aria-label="Dismiss"
                    className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/40 hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

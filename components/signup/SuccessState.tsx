import { CheckCircle2 } from "lucide-react";

export function SuccessState() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-12 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 shadow-glow-emerald">
        <CheckCircle2 className="h-9 w-9" />
      </span>
      <h2 className="text-xl font-semibold text-white">You&apos;re all set</h2>
      <p className="text-sm text-white/55">Redirecting you to the trading terminal…</p>
    </div>
  );
}

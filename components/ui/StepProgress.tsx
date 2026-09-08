import { cn } from "@/lib/utils";

interface StepProgressProps {
  currentStep: number;
  totalSteps: number;
  label?: string;
  className?: string;
}

export function StepProgress({ currentStep, totalSteps, label, className }: StepProgressProps) {
  return (
    <div className={cn("mb-6", className)}>
      <div className="mb-2 flex items-center justify-between text-xs font-medium text-white/50">
        <span>
          Step {currentStep} of {totalSteps}
        </span>
        {label ? <span className="text-white/70">{label}</span> : null}
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: totalSteps }).map((_, index) => (
          <span
            key={index}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              index < currentStep ? "bg-violet-500" : "bg-white/5"
            )}
          />
        ))}
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";

interface OnboardingProgressProps {
  step: number;
  total: number;
}

export function OnboardingProgress({ step, total }: OnboardingProgressProps) {
  return (
    <div className="mx-auto flex w-full max-w-md gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-1 flex-1 rounded-full transition-colors",
            i < step ? "bg-brand" : "bg-surface-2"
          )}
        />
      ))}
    </div>
  );
}

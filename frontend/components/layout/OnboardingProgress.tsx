import { cn } from "@/lib/utils";

interface OnboardingProgressProps {
  step: number;
  total: number;
}

export function OnboardingProgress({ step, total }: OnboardingProgressProps) {
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-2 flex items-center justify-between font-mono text-xs text-muted-foreground">
        <span>
          STEP {step} OF {total}
        </span>
      </div>
      <div className="flex gap-2">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={cn(
              "h-0.5 flex-1 rounded-full transition-colors",
              i < step ? "bg-brand" : "bg-border"
            )}
          />
        ))}
      </div>
    </div>
  );
}

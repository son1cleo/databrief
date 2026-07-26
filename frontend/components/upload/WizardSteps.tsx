import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/** Horizontal numbered stepper. Completed steps collapse to a check, the
 * active step is brand-tinted, upcoming steps stay recessed. */
export function WizardSteps({ step, labels }: { step: number; labels: string[] }) {
  return (
    <ol className="flex items-center gap-2">
      {labels.map((label, i) => {
        const index = i + 1;
        const done = index < step;
        const active = index === step;

        return (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-150",
                done && "bg-success/15 text-success",
                active && "bg-brand/15 text-brand",
                !done && !active && "bg-inset text-muted-foreground"
              )}
            >
              {done ? <Check className="size-3.5" /> : index}
            </span>
            <span
              className={cn(
                "hidden truncate text-xs font-medium sm:block",
                active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {label}
            </span>
            {i < labels.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "h-px min-w-3 flex-1 transition-colors duration-150",
                  done ? "bg-success/40" : "bg-border-soft"
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { INDUSTRIES } from "./onboarding-data";

interface IndustryStepProps {
  value: string | null;
  onChange: (key: string) => void;
  onContinue: () => void;
}

export function IndustryStep({ value, onChange, onContinue }: IndustryStepProps) {
  return (
    <div>
      <h2 className="mb-2 text-center text-2xl font-semibold tracking-tight">
        What&apos;s your industry?
      </h2>
      <p className="mb-8 text-center text-sm text-text-muted">
        This shapes the vocabulary DataBrief uses when it writes your stories.
      </p>

      <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {INDUSTRIES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={cn(
              "flex flex-col items-center gap-3 rounded-xl border p-5 transition-colors",
              value === key
                ? "border-brand bg-brand/10"
                : "border-border bg-surface hover:border-text-subtle"
            )}
          >
            <Icon className={cn("size-6", value === key ? "text-brand" : "text-text-muted")} />
            <span className="text-sm font-medium">{label}</span>
          </button>
        ))}
      </div>

      <div className="flex justify-center">
        <Button size="lg" disabled={!value} onClick={onContinue} className="bg-brand hover:bg-brand-hover">
          Continue
        </Button>
      </div>
    </div>
  );
}

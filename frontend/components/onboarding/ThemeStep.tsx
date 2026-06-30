import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PPTX_THEMES } from "./onboarding-data";

interface ThemeStepProps {
  value: string;
  onChange: (key: string) => void;
  onFinish: () => void;
  loading: boolean;
}

export function ThemeStep({ value, onChange, onFinish, loading }: ThemeStepProps) {
  return (
    <div>
      <h2 className="mb-2 text-center text-2xl font-semibold tracking-tight">Choose your look</h2>
      <p className="mb-8 text-center text-sm text-text-muted">
        Your default PowerPoint theme. You can change this anytime in settings.
      </p>

      <div className="mb-10 grid gap-3 sm:grid-cols-2">
        {PPTX_THEMES.map((theme) => (
          <button
            key={theme.key}
            onClick={() => onChange(theme.key)}
            className={cn(
              "overflow-hidden rounded-xl border text-left transition-colors",
              value === theme.key ? "border-brand" : "border-border hover:border-text-subtle"
            )}
          >
            <div
              className="flex h-20 items-center justify-center"
              style={{ background: theme.background }}
            >
              <span className="text-lg font-semibold" style={{ color: theme.accent, fontFamily: theme.font }}>
                Aa
              </span>
            </div>
            <div className="bg-surface p-3.5">
              <p className="text-sm font-medium">{theme.label}</p>
              <p className="text-xs text-text-muted">{theme.description}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="flex justify-center">
        <Button size="lg" onClick={onFinish} disabled={loading} className="bg-brand hover:bg-brand-hover">
          {loading ? "Finishing up..." : "Go to dashboard"}
        </Button>
      </div>
    </div>
  );
}

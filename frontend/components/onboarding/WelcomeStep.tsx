import { Button } from "@/components/ui/button";

interface WelcomeStepProps {
  name: string;
  onContinue: () => void;
}

export function WelcomeStep({ name, onContinue }: WelcomeStepProps) {
  const firstName = name.split(" ")[0] || name;

  return (
    <div className="text-center">
      <div className="mx-auto mb-8 flex size-20 animate-pulse items-center justify-center rounded-2xl bg-brand/15 glow-accent">
        <span className="text-3xl font-bold text-brand">D</span>
      </div>
      <h1 className="mb-3 text-3xl font-semibold tracking-tight">
        Welcome to DataBrief, {firstName}.
      </h1>
      <p className="mb-10 text-text-muted">Let&apos;s set you up in 3 steps.</p>
      <Button size="lg" onClick={onContinue} className="bg-brand hover:bg-brand-hover">
        Continue
      </Button>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { OnboardingProgress } from "@/components/layout/OnboardingProgress";
import { WelcomeStep } from "./WelcomeStep";
import { IndustryStep } from "./IndustryStep";
import { UploadStep } from "./UploadStep";
import { ThemeStep } from "./ThemeStep";
import { completeOnboarding } from "@/app/(app)/onboarding/actions";

interface OnboardingWizardProps {
  name: string;
}

const TOTAL_STEPS = 4;

export function OnboardingWizard({ name }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [industry, setIndustry] = useState<string | null>(null);
  const [theme, setTheme] = useState("boardroom");
  const [, setFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));

  const finish = () => {
    startTransition(() => {
      completeOnboarding({ industry: industry ?? "other", default_pptx_theme: theme });
    });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <div className="mb-10 w-full max-w-xl">
        <OnboardingProgress step={step} total={TOTAL_STEPS} />
      </div>

      <div className="w-full max-w-xl">
        {step === 1 && <WelcomeStep name={name} onContinue={next} />}
        {step === 2 && (
          <IndustryStep value={industry} onChange={setIndustry} onContinue={next} />
        )}
        {step === 3 && <UploadStep onFileSelected={setFile} onContinue={next} />}
        {step === 4 && (
          <ThemeStep value={theme} onChange={setTheme} onFinish={finish} loading={isPending} />
        )}
      </div>
    </div>
  );
}

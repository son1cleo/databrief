"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface WelcomeStepProps {
  name: string;
  onContinue: () => void;
}

export function WelcomeStep({ name, onContinue }: WelcomeStepProps) {
  const firstName = name.split(" ")[0] || name;
  const lines = [`> Welcome, ${firstName}.`, "> Let's set you up in 3 steps."];
  const [typed, setTyped] = useState<string[]>(["", ""]);

  useEffect(() => {
    let cancelled = false;

    async function typeLines() {
      for (let li = 0; li < lines.length; li++) {
        const full = lines[li];
        for (let ci = 0; ci <= full.length; ci++) {
          if (cancelled) return;
          await new Promise((r) => setTimeout(r, 40));
          setTyped((prev) => {
            const next = [...prev];
            next[li] = full.slice(0, ci);
            return next;
          });
        }
      }
    }

    typeLines();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finished = typed[1] === lines[1];

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="glow-brand overflow-hidden rounded-lg border border-border bg-surface">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="size-3 rounded-full bg-[#ff5f57]" />
          <span className="size-3 rounded-full bg-[#ffbd2e]" />
          <span className="size-3 rounded-full bg-[#28c840]" />
          <span className="ml-3 font-mono text-xs text-muted-foreground">
            databrief://onboarding
          </span>
        </div>
        <div className="space-y-2 px-6 py-8">
          <p className="font-mono text-sm text-data-ink">
            {typed[0]}
            {typed[0].length < lines[0].length && <span className="cursor-blink" />}
          </p>
          <p className="font-mono text-sm text-foreground/80">
            {typed[1]}
            {finished && <span className="cursor-blink" />}
          </p>
        </div>
      </div>
      <div className="mt-8 flex justify-center">
        <Button size="lg" onClick={onContinue} className="bg-brand font-mono hover:bg-brand-hover">
          Continue →
        </Button>
      </div>
    </div>
  );
}

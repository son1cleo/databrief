"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { INDUSTRIES, PPTX_THEMES } from "@/components/onboarding/onboarding-data";

export interface StepConfig {
  formats: string[];
  pptxTheme: string;
  applyBrandKit: boolean;
  industry: string;
  question: string;
}

interface Step3ConfigureProps {
  defaultIndustry: string | null;
  hasBrandKit: boolean;
  onBack: () => void;
  onContinue: (config: StepConfig) => void;
}

export function Step3Configure({ defaultIndustry, hasBrandKit, onBack, onContinue }: Step3ConfigureProps) {
  const [includeWord, setIncludeWord] = useState(false);
  const [includePptx, setIncludePptx] = useState(false);
  const [pptxTheme, setPptxTheme] = useState("boardroom");
  const [applyBrandKit, setApplyBrandKit] = useState(false);
  const [industry, setIndustry] = useState(defaultIndustry ?? "other");
  const [question, setQuestion] = useState("");

  const handleContinue = () => {
    const formats = ["pdf", ...(includeWord ? ["word"] : []), ...(includePptx ? ["pptx"] : [])];
    onContinue({ formats, pptxTheme, applyBrandKit, industry, question });
  };

  return (
    <div>
      <h2 className="mb-2 text-2xl font-semibold tracking-tight">Configure your report</h2>
      <p className="mb-8 text-text-muted">Choose output formats and tailor the story.</p>

      <div className="mb-8">
        <p className="mb-3 text-sm font-medium">Output formats</p>
        <div className="space-y-2.5">
          <label className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3.5 opacity-70">
            <Checkbox checked disabled />
            <span className="text-sm">PDF</span>
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3.5 cursor-pointer">
            <Checkbox checked={includeWord} onCheckedChange={(v) => setIncludeWord(v === true)} />
            <span className="text-sm">Word document</span>
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3.5 cursor-pointer">
            <Checkbox checked={includePptx} onCheckedChange={(v) => setIncludePptx(v === true)} />
            <span className="text-sm">PowerPoint presentation</span>
          </label>
        </div>
      </div>

      {includePptx && (
        <div className="mb-8">
          <p className="mb-3 text-sm font-medium">PowerPoint theme</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {PPTX_THEMES.map((theme) => (
              <button
                key={theme.key}
                onClick={() => setPptxTheme(theme.key)}
                className={cn(
                  "overflow-hidden rounded-lg border text-left transition-colors",
                  pptxTheme === theme.key ? "border-brand" : "border-border hover:border-text-subtle"
                )}
              >
                <div className="flex h-12 items-center justify-center" style={{ background: theme.background }}>
                  <span className="text-xs font-semibold" style={{ color: theme.accent }}>
                    Aa
                  </span>
                </div>
                <p className="bg-surface px-2 py-1.5 text-[11px] font-medium">{theme.label}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {hasBrandKit && (
        <div className="mb-8 flex items-center justify-between rounded-lg border border-border bg-surface p-4">
          <div>
            <p className="text-sm font-medium">Apply my brand kit</p>
            <p className="text-xs text-text-muted">Uses your logo and brand colors on every export.</p>
          </div>
          <Switch checked={applyBrandKit} onCheckedChange={setApplyBrandKit} />
        </div>
      )}

      <div className="mb-6">
        <Label className="mb-2 block text-sm font-medium">Industry</Label>
        <Select value={industry} onValueChange={(v) => v && setIndustry(v)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INDUSTRIES.map((ind) => (
              <SelectItem key={ind.key} value={ind.key}>
                {ind.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-8">
        <Label className="mb-2 block text-sm font-medium">
          What question are you trying to answer? <span className="text-text-muted">(optional)</span>
        </Label>
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. Why did churn spike in Q3?"
          rows={3}
        />
      </div>

      <div className="flex justify-between">
        <Button variant="outline" size="lg" onClick={onBack}>
          Back
        </Button>
        <Button size="lg" onClick={handleContinue} className="bg-brand hover:bg-brand-hover">
          Generate report
        </Button>
      </div>
    </div>
  );
}

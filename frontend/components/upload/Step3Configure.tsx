"use client";

import { useState } from "react";
import { Building2, FileCog, MessageCircleQuestionMark, Palette, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Panel, PanelBody, PanelFooter, PanelHeader } from "@/components/ui/panel";
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
  backLabel?: string;
  /** Drop the Panel chrome when this already sits on a card surface (e.g.
   * inside a dialog), so we don't nest a card inside a card. */
  embedded?: boolean;
}

export function Step3Configure({
  defaultIndustry,
  hasBrandKit,
  onBack,
  onContinue,
  backLabel = "Back",
  embedded = false,
}: Step3ConfigureProps) {
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

  const body = (
    <>
      <div className="space-y-6">
        <div>
          <p className="mb-2.5 text-sm font-medium text-foreground">Output formats</p>
          <div className="space-y-2">
            <label className="flex items-center gap-3 rounded-xl bg-inset p-3.5 opacity-70">
              <Checkbox checked disabled />
              <span className="text-sm">PDF</span>
              <span className="ml-auto text-xs text-muted-foreground">Always included</span>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-inset p-3.5 transition-colors duration-150 hover:bg-surface-2">
              <Checkbox checked={includeWord} onCheckedChange={(v) => setIncludeWord(v === true)} />
              <span className="text-sm">Word document</span>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-inset p-3.5 transition-colors duration-150 hover:bg-surface-2">
              <Checkbox checked={includePptx} onCheckedChange={(v) => setIncludePptx(v === true)} />
              <span className="text-sm">PowerPoint presentation</span>
            </label>
          </div>
        </div>

        {includePptx && (
          <div>
            <p className="mb-2.5 flex items-center gap-2 text-sm font-medium text-foreground">
              <Presentation className="size-4 text-muted-foreground" />
              PowerPoint theme
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {PPTX_THEMES.map((theme) => (
                <button
                  key={theme.key}
                  type="button"
                  onClick={() => setPptxTheme(theme.key)}
                  aria-pressed={pptxTheme === theme.key}
                  className={cn(
                    "overflow-hidden rounded-xl border text-left transition-colors duration-150",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    pptxTheme === theme.key
                      ? "border-brand"
                      : "border-border-soft hover:border-brand/40"
                  )}
                >
                  <div
                    className="flex h-12 items-center justify-center"
                    style={{ background: theme.background }}
                  >
                    <span className="text-xs font-semibold" style={{ color: theme.accent }}>
                      Aa
                    </span>
                  </div>
                  <p className="bg-inset px-2 py-1.5 text-[11px] font-medium">{theme.label}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {hasBrandKit && (
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-inset p-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <Palette className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Apply my brand kit</p>
                <p className="text-xs text-muted-foreground">
                  Uses your logo and brand colors on every export.
                </p>
              </div>
            </div>
            <Switch checked={applyBrandKit} onCheckedChange={setApplyBrandKit} />
          </label>
        )}

        <div>
          <Label className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Building2 className="size-4 text-muted-foreground" />
            Industry
          </Label>
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

        <div>
          <Label className="mb-2 flex items-center gap-2 text-sm font-medium">
            <MessageCircleQuestionMark className="size-4 text-muted-foreground" />
            What question are you trying to answer?
            <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Why did churn spike in Q3?"
            rows={3}
          />
        </div>
      </div>
    </>
  );

  const actions = (
    <>
      <Button variant="outline" onClick={onBack}>
        {backLabel}
      </Button>
      <Button onClick={handleContinue}>Generate report</Button>
    </>
  );

  if (embedded) {
    return (
      <div className="space-y-6">
        {body}
        <div className="flex items-center justify-between gap-2 border-t border-border-soft pt-4">
          {actions}
        </div>
      </div>
    );
  }

  return (
    <Panel>
      <PanelHeader
        icon={FileCog}
        title="Configure your report"
        description="Choose output formats and tailor the story."
      />
      <PanelBody>{body}</PanelBody>
      <PanelFooter className="justify-between">{actions}</PanelFooter>
    </Panel>
  );
}

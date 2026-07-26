"use client";

import { useState, useTransition } from "react";
import { signOut } from "next-auth/react";
import { AtSign, Brain, Building2, LogOut, Presentation, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FieldRow } from "@/components/ui/field-row";
import { Label } from "@/components/ui/label";
import { Panel, PanelBody, PanelFooter, PanelHeader } from "@/components/ui/panel";
import { SettingsSection } from "@/components/ui/settings-section";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INDUSTRIES, PPTX_THEMES } from "@/components/onboarding/onboarding-data";
import { updateProfile } from "@/app/(app)/settings/actions";
import { LLM_PROVIDER_LABELS } from "@/lib/llm/providerMeta";
import type { UserOut } from "@/lib/types";

const AUTO_PROVIDER = "auto";

interface ProfileSettingsProps {
  user: UserOut;
  avatarUrl?: string | null;
  /** Providers this deployment has an API key configured for, in fallback
   * order. Only these (plus "auto") are offered -- picking an unconfigured
   * provider would just fall straight through to the fallback chain anyway. */
  availableProviders: string[];
}

export function ProfileSettings({ user, avatarUrl, availableProviders }: ProfileSettingsProps) {
  const [industry, setIndustry] = useState(user.industry ?? "other");
  const [theme, setTheme] = useState(user.default_pptx_theme ?? "boardroom");
  const [provider, setProvider] = useState(user.preferred_llm_provider ?? AUTO_PROVIDER);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const initials = (user.name ?? user.email).slice(0, 1).toUpperCase();

  const handleSave = () => {
    setSaved(false);
    startTransition(async () => {
      await updateProfile({
        industry,
        default_pptx_theme: theme,
        preferred_llm_provider: provider === AUTO_PROVIDER ? null : provider,
      });
      setSaved(true);
    });
  };

  return (
    <div className="space-y-8">
      <SettingsSection title="Profile" description="How your account appears across DataBrief.">
        <Panel>
          <PanelBody className="flex items-center gap-4">
            <Avatar className="size-14">
              <AvatarImage src={avatarUrl ?? undefined} alt="" />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{user.name ?? "Unnamed"}</p>
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelBody className="divide-y divide-border-soft py-1">
            <FieldRow icon={UserRound} label="Name">
              {user.name ?? "—"}
            </FieldRow>
            <FieldRow icon={AtSign} label="Email address">
              {user.email}
            </FieldRow>
          </PanelBody>
        </Panel>
      </SettingsSection>

      <SettingsSection
        title="Report defaults"
        description="Applied to every new report unless you change them at generation time."
      >
        <Panel>
          <PanelBody className="space-y-5">
            <div>
              <Label className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Building2 className="size-4 text-muted-foreground" />
                Industry
              </Label>
              <Select value={industry} onValueChange={(v) => v && setIndustry(v)}>
                <SelectTrigger className="w-full sm:w-72">
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
                <Presentation className="size-4 text-muted-foreground" />
                Default PowerPoint theme
              </Label>
              <Select value={theme} onValueChange={(v) => v && setTheme(v)}>
                <SelectTrigger className="w-full sm:w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PPTX_THEMES.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Brain className="size-4 text-muted-foreground" />
                AI model for reports
              </Label>
              <Select value={provider} onValueChange={(v) => v && setProvider(v)}>
                <SelectTrigger className="w-full sm:w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUTO_PROVIDER}>Auto (recommended)</SelectItem>
                  {availableProviders.map((p) => (
                    <SelectItem key={p} value={p}>
                      {LLM_PROVIDER_LABELS[p] ?? p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {availableProviders.length > 0
                  ? "Auto tries providers in order and falls back automatically if one fails. Pick a specific model to prefer it."
                  : "No AI providers are configured for this deployment yet -- reports will use the built-in template narrator."}
              </p>
            </div>
          </PanelBody>
          <PanelFooter className="justify-end">
            {saved && <span className="mr-auto text-sm text-success">Saved</span>}
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? "Saving…" : "Save changes"}
            </Button>
          </PanelFooter>
        </Panel>
      </SettingsSection>

      <SettingsSection title="Danger zone" description="Proceed with caution.">
        <Panel className="border-error/25">
          <PanelHeader
            title="Account actions"
            description="Sign out of DataBrief on this device."
          />
          <PanelBody>
            <Button variant="outline" onClick={() => signOut({ callbackUrl: "/" })}>
              <LogOut />
              Sign out
            </Button>
          </PanelBody>
        </Panel>
      </SettingsSection>
    </div>
  );
}

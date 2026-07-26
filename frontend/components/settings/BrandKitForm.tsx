"use client";

import { useState, useTransition } from "react";
import { Eye, Image as ImageIcon, Palette, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, PanelBody, PanelFooter, PanelHeader } from "@/components/ui/panel";
import { SettingsSection } from "@/components/ui/settings-section";
import { updateProfile } from "@/app/(app)/settings/actions";
import type { UserOut } from "@/lib/types";

interface BrandKitFormProps {
  user: UserOut;
}

export function BrandKitForm({ user }: BrandKitFormProps) {
  const [logoUrl, setLogoUrl] = useState(user.brand_logo_url ?? "");
  const [primary, setPrimary] = useState(user.brand_primary ?? "#2563eb");
  const [secondary, setSecondary] = useState(user.brand_secondary ?? "#10b981");
  const [font, setFont] = useState(user.brand_font ?? "");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(false);
    startTransition(async () => {
      await updateProfile({
        brand_logo_url: logoUrl,
        brand_primary: primary,
        brand_secondary: secondary,
        brand_font: font,
      });
      setSaved(true);
    });
  };

  return (
    <div className="space-y-8">
      <SettingsSection
        title="Brand kit"
        description="Applied to branded PDF and PowerPoint exports."
      >
        <Panel>
          <PanelBody className="space-y-5">
            <div>
              <Label className="mb-2 flex items-center gap-2 text-sm font-medium">
                <ImageIcon className="size-4 text-muted-foreground" />
                Logo URL
              </Label>
              <Input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://your-domain.com/logo.png"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Used in branded PDF and PowerPoint exports.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Palette className="size-4 text-muted-foreground" />
                  Primary color
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Primary color"
                    value={primary}
                    onChange={(e) => setPrimary(e.target.value)}
                    className="size-9 shrink-0 cursor-pointer rounded-lg border border-border-soft bg-transparent"
                  />
                  <Input value={primary} onChange={(e) => setPrimary(e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Palette className="size-4 text-muted-foreground" />
                  Secondary color
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Secondary color"
                    value={secondary}
                    onChange={(e) => setSecondary(e.target.value)}
                    className="size-9 shrink-0 cursor-pointer rounded-lg border border-border-soft bg-transparent"
                  />
                  <Input value={secondary} onChange={(e) => setSecondary(e.target.value)} />
                </div>
              </div>
            </div>

            <div>
              <Label className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Type className="size-4 text-muted-foreground" />
                Font name
              </Label>
              <Input
                value={font}
                onChange={(e) => setFont(e.target.value)}
                placeholder="e.g. Helvetica Neue"
              />
            </div>
          </PanelBody>
          <PanelFooter className="justify-end">
            {saved && <span className="mr-auto text-sm text-success">Saved</span>}
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? "Saving…" : "Save brand kit"}
            </Button>
          </PanelFooter>
        </Panel>
      </SettingsSection>

      {logoUrl && (
        <SettingsSection title="Preview" description="How your brand appears on an export header.">
          <Panel>
            <PanelHeader icon={Eye} title="Export header preview" />
            <PanelBody>
              <div
                className="flex items-center gap-3 rounded-xl border bg-inset p-4"
                style={{ borderColor: primary }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt="Brand logo" className="h-8 max-w-32 object-contain" />
                <span className="text-sm font-medium" style={{ color: primary }}>
                  Sample heading
                </span>
              </div>
            </PanelBody>
          </Panel>
        </SettingsSection>
      )}
    </div>
  );
}

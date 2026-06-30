"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface p-5 space-y-5">
        <div>
          <Label className="mb-2 block text-sm font-medium">Logo URL</Label>
          <Input
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://your-domain.com/logo.png"
          />
          <p className="mt-1.5 text-xs text-text-muted">
            Used in branded PDF and PowerPoint exports.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label className="mb-2 block text-sm font-medium">Primary color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={primary}
                onChange={(e) => setPrimary(e.target.value)}
                className="size-9 shrink-0 cursor-pointer rounded-md border border-border bg-transparent"
              />
              <Input value={primary} onChange={(e) => setPrimary(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="mb-2 block text-sm font-medium">Secondary color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={secondary}
                onChange={(e) => setSecondary(e.target.value)}
                className="size-9 shrink-0 cursor-pointer rounded-md border border-border bg-transparent"
              />
              <Input value={secondary} onChange={(e) => setSecondary(e.target.value)} />
            </div>
          </div>
        </div>

        <div>
          <Label className="mb-2 block text-sm font-medium">Font name</Label>
          <Input value={font} onChange={(e) => setFont(e.target.value)} placeholder="e.g. Helvetica Neue" />
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={isPending} className="bg-brand hover:bg-brand-hover">
            {isPending ? "Saving..." : "Save brand kit"}
          </Button>
          {saved && <span className="text-sm text-success">Saved</span>}
        </div>
      </div>

      {logoUrl && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="mb-3 text-xs uppercase tracking-wide text-text-muted">Preview</p>
          <div
            className="flex items-center gap-3 rounded-lg border p-4"
            style={{ borderColor: primary }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="Brand logo" className="h-8 max-w-32 object-contain" />
            <span className="text-sm font-medium" style={{ color: primary }}>
              Sample heading
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

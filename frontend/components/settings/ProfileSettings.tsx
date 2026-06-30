"use client";

import { useState, useTransition } from "react";
import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INDUSTRIES, PPTX_THEMES } from "@/components/onboarding/onboarding-data";
import { updateProfile } from "@/app/(app)/settings/actions";
import type { UserOut } from "@/lib/types";

interface ProfileSettingsProps {
  user: UserOut;
  avatarUrl?: string | null;
}

export function ProfileSettings({ user, avatarUrl }: ProfileSettingsProps) {
  const [industry, setIndustry] = useState(user.industry ?? "other");
  const [theme, setTheme] = useState(user.default_pptx_theme ?? "boardroom");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const initials = (user.name ?? user.email).slice(0, 1).toUpperCase();

  const handleSave = () => {
    setSaved(false);
    startTransition(async () => {
      await updateProfile({ industry, default_pptx_theme: theme });
      setSaved(true);
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-5">
        <Avatar className="size-14">
          <AvatarImage src={avatarUrl ?? undefined} alt={user.name ?? ""} />
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">{user.name ?? "Unnamed"}</p>
          <p className="text-sm text-text-muted">{user.email}</p>
        </div>
      </div>

      <div className="space-y-5 rounded-xl border border-border bg-surface p-5">
        <div>
          <Label className="mb-2 block text-sm font-medium">Industry</Label>
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
          <Label className="mb-2 block text-sm font-medium">Default PowerPoint theme</Label>
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

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={isPending} className="bg-brand hover:bg-brand-hover">
            {isPending ? "Saving..." : "Save changes"}
          </Button>
          {saved && <span className="text-sm text-success">Saved</span>}
        </div>
      </div>

      <Button variant="outline" onClick={() => signOut({ callbackUrl: "/" })}>
        Sign out
      </Button>
    </div>
  );
}

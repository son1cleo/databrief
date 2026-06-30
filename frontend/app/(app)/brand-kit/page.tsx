import { getApiToken } from "@/lib/apiToken";
import { apiFetch } from "@/lib/api";
import { BrandKitForm } from "@/components/settings/BrandKitForm";
import type { UserOut } from "@/lib/types";

export default async function BrandKitPage() {
  const token = await getApiToken();
  const user = await apiFetch<UserOut>("/api/auth/me", { token });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Brand Kit</h1>
        <p className="mt-1 text-sm text-text-muted">
          Add your logo and colors to apply your brand to every report export.
        </p>
      </div>
      <BrandKitForm user={user} />
    </div>
  );
}

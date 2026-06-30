import { getApiToken } from "@/lib/apiToken";
import { apiFetch } from "@/lib/api";
import { UploadWizard } from "@/components/upload/UploadWizard";
import type { UserOut } from "@/lib/types";

export default async function UploadPage() {
  const token = await getApiToken();
  const user = await apiFetch<UserOut>("/api/auth/me", { token });

  return (
    <UploadWizard defaultIndustry={user.industry} hasBrandKit={Boolean(user.brand_logo_url)} />
  );
}

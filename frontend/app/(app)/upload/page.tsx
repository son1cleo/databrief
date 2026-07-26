import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { UploadWizard } from "@/components/upload/UploadWizard";

export default async function UploadPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <UploadWizard defaultIndustry={user.industry} hasBrandKit={Boolean(user.brandLogoUrl)} />;
}

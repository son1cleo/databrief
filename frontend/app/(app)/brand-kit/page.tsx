import { redirect } from "next/navigation";
import { getCurrentUser, toUserOut } from "@/lib/getCurrentUser";
import { BrandKitForm } from "@/components/settings/BrandKitForm";

export default async function BrandKitPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  const user = toUserOut(currentUser);

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

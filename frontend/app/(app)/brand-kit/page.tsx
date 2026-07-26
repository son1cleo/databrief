import { redirect } from "next/navigation";
import { getCurrentUser, toUserOut } from "@/lib/getCurrentUser";
import { BrandKitForm } from "@/components/settings/BrandKitForm";

export default async function BrandKitPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  const user = toUserOut(currentUser);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Add your logo and colors to apply your brand to every report export.
      </p>
      <BrandKitForm user={user} />
    </div>
  );
}

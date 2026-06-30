import { auth } from "@/lib/auth";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export default async function OnboardingPage() {
  const session = await auth();
  return <OnboardingWizard name={session?.user?.name ?? "there"} />;
}

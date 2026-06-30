import { MarketingNav } from "@/components/marketing/MarketingNav";
import { HeroSection } from "@/components/marketing/HeroSection";
import { StatsBar } from "@/components/marketing/StatsBar";
import { FindingSection } from "@/components/marketing/FindingSection";
import { FeaturesSection } from "@/components/marketing/FeaturesSection";
import { PricingSection } from "@/components/marketing/PricingSection";
import { CTASection } from "@/components/marketing/CTASection";
import { Footer } from "@/components/marketing/Footer";

export default function MarketingHome() {
  return (
    <>
      <MarketingNav />
      <main className="flex-1">
        <HeroSection />
        <StatsBar />
        <FindingSection />
        <FeaturesSection />
        <PricingSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}

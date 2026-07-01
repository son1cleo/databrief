import { MarketingNav } from "@/components/marketing/MarketingNav";
import { HeroSection } from "@/components/marketing/HeroSection";
import { FindingSection } from "@/components/marketing/FindingSection";
import { DebtSlider } from "@/components/marketing/DebtSlider";
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
        <FindingSection />
        <section className="border-t border-border py-24">
          <div className="mx-auto max-w-7xl px-6">
            <p className="mb-3 font-mono text-xs text-data-ink">EXPLORE THE DATA</p>
            <h2 className="mb-10 font-display text-4xl font-bold tracking-tight text-foreground">
              Drag the slider. Watch the story respond.
            </h2>
            <DebtSlider />
          </div>
        </section>
        <FeaturesSection />
        <PricingSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}

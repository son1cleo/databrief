import Link from "next/link";
import { DebtSlider } from "./DebtSlider";

export function HeroSection() {
  return (
    <section className="relative flex flex-col items-center justify-center px-6 pt-32 pb-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="h-[600px] w-[900px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(37,99,235,0.12)_0%,transparent_68%)]" />
      </div>

      <div className="relative z-10 w-full max-w-4xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 mb-9 text-xs font-medium text-text-muted">
          <span className="size-1.5 rounded-full bg-brand shrink-0" />
          Data Storytelling, Automated
        </div>

        <h1 className="text-[clamp(40px,8vw,88px)] font-extrabold leading-[1.02] tracking-tight mb-6">
          <span className="block">Your data knows</span>
          <span className="block">something you don&apos;t.</span>
        </h1>

        <p className="mx-auto mb-10 max-w-xl text-lg leading-relaxed text-text-muted">
          Upload any spreadsheet, PDF, or document. DataBrief finds what&apos;s surprising
          and writes it like a story — delivered as PDF, Word, or a branded deck.
        </p>

        <div className="mb-16 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/login"
            className="rounded-md bg-brand px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
          >
            Find out what
          </Link>
          <Link
            href="#features"
            className="rounded-md border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:border-text-subtle"
          >
            See how it works
          </Link>
        </div>

        <div className="text-left">
          <p className="mb-3 text-center text-xs text-text-muted">
            A real story DataBrief found in 724 real-estate company filings
          </p>
          <DebtSlider />
        </div>
      </div>

      <div className="relative z-10 mt-12">
        <div className="mx-auto h-12 w-px bg-gradient-to-b from-border to-transparent" />
      </div>
    </section>
  );
}

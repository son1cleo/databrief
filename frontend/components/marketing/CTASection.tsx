import Link from "next/link";

export function CTASection() {
  return (
    <section className="border-t border-border py-24">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <h2 className="mb-5 font-display text-[clamp(28px,4vw,40px)] leading-tight font-bold">
          Find out what your data knows.
        </h2>
        <p className="mb-9 text-muted-foreground">
          Upload a file. Get a story back. No dashboards to configure.
        </p>
        <Link
          href="/login"
          className="glow-brand-hover inline-block rounded bg-brand px-7 py-3 font-mono text-sm text-white transition-all hover:bg-brand-hover"
        >
          Get started free
        </Link>
      </div>
    </section>
  );
}

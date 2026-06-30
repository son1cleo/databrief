import Link from "next/link";

export function CTASection() {
  return (
    <section className="border-t border-border px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="mb-5 text-[clamp(28px,4vw,40px)] font-bold leading-tight">
          Find out what your data knows.
        </h2>
        <p className="mb-9 text-text-muted">
          Upload a file. Get a story back. No dashboards to configure.
        </p>
        <Link
          href="/login"
          className="inline-block rounded-md bg-brand px-7 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-hover glow-accent-hover"
        >
          Get started free
        </Link>
      </div>
    </section>
  );
}

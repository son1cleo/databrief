import Link from "next/link";

export function MarketingNav() {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <span className="font-display text-base font-bold tracking-tight text-foreground">
          DataBrief
        </span>
        <div className="flex items-center gap-8">
          <Link
            href="#features"
            className="hidden font-mono text-xs tracking-wide text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            FEATURES
          </Link>
          <Link
            href="#pricing"
            className="hidden font-mono text-xs tracking-wide text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            PRICING
          </Link>
          <Link
            href="/login"
            className="rounded border border-brand bg-brand/10 px-4 py-1.5 font-mono text-xs whitespace-nowrap text-brand transition-all hover:bg-brand hover:text-white"
          >
            GET ACCESS →
          </Link>
        </div>
      </div>
    </nav>
  );
}

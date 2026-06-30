import Link from "next/link";

export function MarketingNav() {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <span className="shrink-0 text-lg font-bold tracking-tight">DataBrief</span>
        <div className="flex items-center gap-4 sm:gap-8">
          <Link
            href="#features"
            className="hidden text-sm text-text-muted transition-colors hover:text-foreground sm:inline"
          >
            Features
          </Link>
          <Link
            href="#pricing"
            className="hidden text-sm text-text-muted transition-colors hover:text-foreground sm:inline"
          >
            Pricing
          </Link>
          <Link
            href="/login"
            className="shrink-0 rounded-md bg-brand px-3.5 py-2 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-brand-hover"
          >
            Get Access
          </Link>
        </div>
      </div>
    </nav>
  );
}

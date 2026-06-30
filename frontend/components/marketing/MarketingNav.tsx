import Link from "next/link";

export function MarketingNav() {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <span className="text-lg font-bold tracking-tight">DataBrief</span>
        <div className="flex items-center gap-8">
          <Link href="#features" className="text-sm text-text-muted transition-colors hover:text-foreground">
            Features
          </Link>
          <Link href="#pricing" className="text-sm text-text-muted transition-colors hover:text-foreground">
            Pricing
          </Link>
          <Link
            href="/login"
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
          >
            Get Access
          </Link>
        </div>
      </div>
    </nav>
  );
}

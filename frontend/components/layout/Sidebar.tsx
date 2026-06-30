import Link from "next/link";
import { NAV_LINKS } from "./nav-links";

export function Sidebar() {
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-sidebar px-3 py-6">
      <Link href="/dashboard" className="px-3 mb-8 text-lg font-semibold tracking-tight">
        DataBrief
      </Link>
      <nav className="flex flex-col gap-1">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

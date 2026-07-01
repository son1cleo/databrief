import Link from "next/link";
import { NAV_LINKS } from "./nav-links";

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-sidebar px-3 py-6 md:flex">
      <Link
        href="/dashboard"
        className="mb-8 px-3 font-display text-base font-bold tracking-tight text-foreground"
      >
        DataBrief
      </Link>
      <nav className="flex flex-col gap-1">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded px-3 py-2 font-mono text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto px-3 pt-6">
        <span className="font-mono text-[10px] text-muted-foreground">v1.0 / stable</span>
      </div>
    </aside>
  );
}

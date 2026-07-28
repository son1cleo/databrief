"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PRIMARY_NAV_LINKS, SECONDARY_NAV_LINKS, type NavLink } from "./nav-links";

/** Icon-only rail entry. The label lives in a tooltip and an sr-only span, so
 * the rail stays narrow without costing screen-reader users the destination. */
function RailLink({ href, label, icon: Icon, active }: NavLink & { active: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex size-10 items-center justify-center rounded-full transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              active
                ? "bg-brand text-white"
                : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
            )}
          />
        }
      >
        <Icon className="size-4.5" />
        <span className="sr-only">{label}</span>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <aside
      // Pinned to the viewport rather than the scroll container, so no amount
      // of page or panel scrolling moves the rail. Its footprint is mirrored by
      // the content panel's left margin in the app layout — keep the two in
      // sync (left-3 + w-16 = 76px).
      className="fixed inset-y-3 left-3 z-30 hidden w-16 flex-col items-center rounded-[2rem] border border-border-soft bg-canvas py-5 shadow-card md:flex"
    >
      <Link
        href="/dashboard"
        aria-label="DataBrief home"
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand font-display text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        D
      </Link>

      <nav aria-label="Main" className="mt-8 flex flex-col items-center gap-2">
        {PRIMARY_NAV_LINKS.map((link) => (
          <RailLink key={link.href} {...link} active={isActive(link.href)} />
        ))}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-2 pt-6">
        <span aria-hidden className="mb-2 h-px w-6 bg-border-soft" />
        {SECONDARY_NAV_LINKS.map((link) => (
          <RailLink key={link.href} {...link} active={isActive(link.href)} />
        ))}
      </div>
    </aside>
  );
}

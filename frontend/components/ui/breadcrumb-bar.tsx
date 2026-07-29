import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: LucideIcon;
}

/** Compact trail shown on detail pages, directly under the header bar. The
 * final item is the current entity and is never a link.
 *
 * Pinned to the top of the app's scrolling <main>, so it reads as one fixed
 * unit with the header above it rather than sliding away on scroll. That means
 * it must stay opaque and full-bleed (the negative margins cancel <main>'s own
 * padding) so page content passes cleanly underneath, and its height is the
 * --crumb-bar-h any secondary sticky bar offsets itself by. */
function BreadcrumbBar({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "sticky top-0 z-30 -mx-4 flex h-(--crumb-bar-h) min-w-0 items-center gap-1.5 border-b border-border-soft bg-canvas px-4 text-xs md:-mx-6 md:px-6",
        className
      )}
    >
      {items.map(({ label, href, icon: Icon }, i) => {
        const last = i === items.length - 1;
        const content = (
          <span className="flex min-w-0 items-center gap-1.5">
            {Icon && <Icon className="size-3.5 shrink-0" />}
            <span className="truncate">{label}</span>
          </span>
        );

        return (
          <span key={`${label}-${i}`} className="flex min-w-0 items-center gap-1.5">
            {href && !last ? (
              <Link
                href={href}
                className="flex min-w-0 items-center rounded-full px-1.5 py-1 text-muted-foreground transition-colors duration-150 hover:bg-surface-2 hover:text-foreground"
              >
                {content}
              </Link>
            ) : (
              <span
                aria-current={last ? "page" : undefined}
                className={cn(
                  "flex min-w-0 items-center px-1.5 py-1",
                  last ? "font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                {content}
              </span>
            )}
            {!last && (
              <span aria-hidden className="text-muted-foreground/50">
                /
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export { BreadcrumbBar };

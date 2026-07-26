"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { NAV_LINKS } from "./nav-links";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open menu"
        className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:hidden"
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-64 border-border-soft bg-canvas">
        <Link
          href="/dashboard"
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 px-4 pt-6 pb-7"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/15 font-display text-sm font-bold text-brand">
            D
          </span>
          <span className="font-display text-lg font-bold tracking-tight">DataBrief</span>
        </Link>
        <nav className="flex flex-col gap-1.5 px-3">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group/nav flex items-center gap-3 rounded-full py-1 text-sm transition-colors duration-150",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors duration-150",
                    active ? "bg-brand/15 text-brand" : "group-hover/nav:bg-surface-2"
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className="font-medium">{label}</span>
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

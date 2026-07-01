"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { NAV_LINKS } from "./nav-links";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="md:hidden text-muted-foreground hover:text-foreground" aria-label="Open menu">
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-64 bg-sidebar border-border">
        <Link
          href="/dashboard"
          onClick={() => setOpen(false)}
          className="block px-4 pt-6 pb-8 font-display text-lg font-bold tracking-tight"
        >
          DataBrief
        </Link>
        <nav className="flex flex-col gap-1 px-3">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded px-3 py-2.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

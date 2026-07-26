"use client";

import { useRef, useState, type FocusEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { NAV_LINKS } from "./nav-links";

const COLLAPSED_WIDTH = 72;
const EXPANDED_WIDTH = 236;

export function Sidebar() {
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();
  const railRef = useRef<HTMLElement>(null);

  // Keep the rail open while focus moves between its own links, so keyboard
  // users can tab through the whole nav without it collapsing under them.
  const handleBlur = (e: FocusEvent<HTMLElement>) => {
    if (!railRef.current?.contains(e.relatedTarget as Node)) setExpanded(false);
  };

  return (
    <>
      {/* Holds the rail's collapsed width in the flex row so expanding it
          never reflows the page beside it. */}
      <div aria-hidden className="hidden w-18 shrink-0 md:block" />
      <motion.aside
        ref={railRef}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        onFocus={() => setExpanded(true)}
        onBlur={handleBlur}
        animate={{ width: expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className={cn(
          "absolute inset-y-0 left-0 z-30 hidden flex-col overflow-hidden bg-canvas px-3.5 py-5 transition-shadow duration-150 md:flex",
          expanded && "shadow-rail"
        )}
      >
        <Link
          href="/dashboard"
          className="mb-7 flex items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/15 font-display text-sm font-bold text-brand">
            D
          </span>
          <span
            className={cn(
              "overflow-hidden font-display text-base font-bold tracking-tight whitespace-nowrap text-foreground transition-opacity duration-150",
              expanded ? "ml-3 opacity-100" : "w-0 opacity-0"
            )}
          >
            DataBrief
          </span>
        </Link>

        <nav className="flex flex-col gap-1.5">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                title={label}
                className={cn(
                  "group/nav flex items-center rounded-full py-1 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors duration-150",
                    active
                      ? "bg-brand/15 text-brand"
                      : "group-hover/nav:bg-surface-2"
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span
                  className={cn(
                    "overflow-hidden font-medium whitespace-nowrap transition-opacity duration-150",
                    expanded ? "ml-3 opacity-100" : "w-0 opacity-0"
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-6 pl-1">
          <span
            className={cn(
              "block overflow-hidden font-mono text-[10px] whitespace-nowrap text-muted-foreground transition-opacity duration-150",
              expanded ? "opacity-100" : "w-0 opacity-0"
            )}
          >
            v1.0 / stable
          </span>
        </div>
      </motion.aside>
    </>
  );
}

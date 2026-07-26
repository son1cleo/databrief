"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Segmented tab strip for entity detail pages: a recessed rail holding
 * tabs, where the active tab lifts to the card surface and its icon picks
 * up a brand tint. Wraps Base UI Tabs, so keyboard/ARIA behaviour is kept. */
function FolderTabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="folder-tabs"
      className={cn("flex flex-col gap-4", className)}
      {...props}
    />
  );
}

function FolderTabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="folder-tabs-list"
      className={cn(
        "flex w-full items-center gap-1 overflow-x-auto rounded-2xl border border-border-soft bg-canvas p-1.5",
        className
      )}
      {...props}
    />
  );
}

function FolderTab({
  icon: Icon,
  count,
  children,
  className,
  ...props
}: TabsPrimitive.Tab.Props & { icon?: LucideIcon; count?: number }) {
  return (
    <TabsPrimitive.Tab
      data-slot="folder-tab"
      className={cn(
        "group/tab flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm whitespace-nowrap transition-colors duration-150",
        "text-muted-foreground hover:text-foreground",
        "data-active:bg-surface data-active:text-foreground data-active:shadow-card",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className
      )}
      {...props}
    >
      {Icon && (
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 group-data-active/tab:bg-brand/15 group-data-active/tab:text-brand"
        >
          <Icon className="size-4" />
        </span>
      )}
      <span className="font-medium">{children}</span>
      {count != null && (
        <span className="rounded-full bg-inset px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground group-data-active/tab:bg-brand/15 group-data-active/tab:text-brand">
          {count}
        </span>
      )}
    </TabsPrimitive.Tab>
  );
}

function FolderTabPanel({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="folder-tab-panel"
      className={cn("outline-none", className)}
      {...props}
    />
  );
}

export { FolderTabs, FolderTabsList, FolderTab, FolderTabPanel };

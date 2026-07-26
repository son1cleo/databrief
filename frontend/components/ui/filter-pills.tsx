"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface FilterPillOption<T extends string = string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  count?: number;
}

/** Row of filter pills with leading icon chips and trailing counts — the
 * list-page equivalent of FolderTabs. Selected pill lifts to the card
 * surface and tints its icon chip. */
function FilterPills<T extends string>({
  options,
  value,
  onValueChange,
  className,
}: {
  options: FilterPillOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {options.map(({ value: optionValue, label, icon: Icon, count }) => {
        const active = optionValue === value;
        return (
          <button
            key={optionValue}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(optionValue)}
            className={cn(
              "group/pill flex items-center gap-2.5 rounded-full border py-1.5 pr-3 pl-1.5 text-sm transition-colors duration-150",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              active
                ? "border-border-soft bg-surface text-foreground shadow-card"
                : "border-transparent text-muted-foreground hover:bg-surface/60 hover:text-foreground"
            )}
          >
            {Icon && (
              <span
                aria-hidden
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full transition-colors duration-150",
                  active ? "bg-brand/15 text-brand" : "bg-inset"
                )}
              >
                <Icon className="size-3.5" />
              </span>
            )}
            <span className="font-medium">{label}</span>
            {count != null && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 font-mono text-[10px]",
                  active ? "bg-brand/15 text-brand" : "bg-inset text-muted-foreground"
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export { FilterPills };

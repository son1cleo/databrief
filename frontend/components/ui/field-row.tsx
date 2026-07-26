import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** A labelled attribute row: muted icon + label on the left, value on the
 * right. Stack several inside a Panel — wrap them in a container with
 * `divide-y divide-border-soft` when the group needs separators. */
function FieldRow({
  icon: Icon,
  label,
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  icon?: LucideIcon;
  label: React.ReactNode;
}) {
  return (
    <div
      data-slot="field-row"
      className={cn("flex items-center justify-between gap-4 py-2.5", className)}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
        {Icon && <Icon className="size-4 shrink-0" />}
        <span className="truncate text-sm">{label}</span>
      </div>
      <div className="min-w-0 shrink-0 text-right text-sm font-medium text-foreground">
        {children}
      </div>
    </div>
  );
}

export { FieldRow };

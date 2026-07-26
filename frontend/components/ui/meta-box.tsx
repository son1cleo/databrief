import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** A recessed metadata cell that sits *inside* a Panel: a small muted
 * icon + label row, with the value beneath. Used in grids of 2–4 to
 * summarise an entity's attributes. */
function MetaBox({
  icon: Icon,
  label,
  value,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  icon?: LucideIcon;
  label: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div
      data-slot="meta-box"
      className={cn("min-w-0 rounded-xl bg-inset px-3.5 py-3", className)}
      {...props}
    >
      <div className="mb-1.5 flex items-center gap-1.5 text-muted-foreground">
        {Icon && <Icon className="size-3.5 shrink-0" />}
        <span className="truncate font-mono text-[10px] tracking-wide uppercase">{label}</span>
      </div>
      <div className="truncate text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

export { MetaBox };

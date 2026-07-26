import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** The app's primary surface: a softly rounded card that floats on the canvas.
 * Depth comes from the surface ladder plus a barely-there border — no heavy
 * outline. Compose with PanelHeader/PanelBody, or pass padding directly for
 * simple cards. */
function Panel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="panel"
      className={cn(
        "rounded-2xl border border-border-soft bg-surface shadow-card",
        className
      )}
      {...props}
    />
  );
}

/** Titled header with an optional trailing slot (badge, button, pager). */
function PanelHeader({
  icon: Icon,
  title,
  description,
  action,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      data-slot="panel-header"
      className={cn(
        "flex items-center justify-between gap-3 border-b border-border-soft px-5 py-4",
        className
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
          {description && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

function PanelBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="panel-body" className={cn("p-5", className)} {...props} />;
}

function PanelFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="panel-footer"
      className={cn(
        "flex items-center gap-2 border-t border-border-soft px-5 py-4",
        className
      )}
      {...props}
    />
  );
}

export { Panel, PanelHeader, PanelBody, PanelFooter };

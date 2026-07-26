import * as React from "react";

import { cn } from "@/lib/utils";

/** Two-column settings block: a sticky-feeling label column on the left
 * (title + description) and the actual content panels on the right.
 * Collapses to a single column on small screens. */
function SettingsSection({
  title,
  description,
  children,
  className,
  ...props
}: Omit<React.ComponentProps<"section">, "title"> & {
  title: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <section
      data-slot="settings-section"
      className={cn("grid gap-4 md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] md:gap-8", className)}
      {...props}
    >
      <div className="md:pt-1">
        <h2 className="font-display text-base font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  );
}

export { SettingsSection };

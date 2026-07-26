import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const COLOR_STYLES = {
  brand: "bg-brand/12 text-brand",
  success: "bg-success/12 text-success",
  warning: "bg-warning/12 text-warning",
  error: "bg-error/12 text-error",
  muted: "bg-inset text-muted-foreground",
} as const;

const SIZE_STYLES = {
  sm: "size-7 [&_svg]:size-3.5",
  md: "size-9 [&_svg]:size-4",
  lg: "size-11 [&_svg]:size-5",
  xl: "size-14 [&_svg]:size-6",
} as const;

interface IconBadgeProps extends Omit<React.ComponentProps<"div">, "color"> {
  icon: LucideIcon;
  color?: keyof typeof COLOR_STYLES;
  size?: keyof typeof SIZE_STYLES;
  shape?: "square" | "circle";
}

/** A softly tinted chip holding a single icon — the reference's recurring
 * accent element. Tints stay low-alpha so colour never shouts. */
function IconBadge({
  icon: Icon,
  color = "brand",
  size = "md",
  shape = "square",
  className,
  ...props
}: IconBadgeProps) {
  return (
    <div
      data-slot="icon-badge"
      className={cn(
        "flex shrink-0 items-center justify-center",
        shape === "circle" ? "rounded-full" : "rounded-xl",
        COLOR_STYLES[color],
        SIZE_STYLES[size],
        className
      )}
      {...props}
    >
      <Icon />
    </div>
  );
}

export { IconBadge };

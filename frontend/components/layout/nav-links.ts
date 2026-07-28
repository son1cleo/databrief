import { LayoutDashboard, Upload, FileText, Database, Settings, Palette, type LucideIcon } from "lucide-react";

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Main sections — the rail's upper cluster. */
export const PRIMARY_NAV_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "New Report", icon: Upload },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/datasets", label: "Datasets", icon: Database },
  { href: "/brand-kit", label: "Brand Kit", icon: Palette },
];

/** Pinned to the foot of the rail, set apart from the section links. */
export const SECONDARY_NAV_LINKS: NavLink[] = [
  { href: "/settings", label: "Settings", icon: Settings },
];

/** Full list, in visual order — used for the header's section title and the
 * mobile sheet, which both render every destination in one flat list. */
export const NAV_LINKS: NavLink[] = [...PRIMARY_NAV_LINKS, ...SECONDARY_NAV_LINKS];

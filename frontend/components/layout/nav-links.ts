import { LayoutDashboard, Upload, FileText, Database, Settings, Palette, type LucideIcon } from "lucide-react";

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "New Report", icon: Upload },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/datasets", label: "Datasets", icon: Database },
  { href: "/brand-kit", label: "Brand Kit", icon: Palette },
  { href: "/settings", label: "Settings", icon: Settings },
];

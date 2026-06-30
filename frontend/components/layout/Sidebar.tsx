import Link from "next/link";
import { LayoutDashboard, Upload, FileText, Settings, Palette } from "lucide-react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "New Report", icon: Upload },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/brand-kit", label: "Brand Kit", icon: Palette },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-sidebar px-3 py-6">
      <Link href="/dashboard" className="px-3 mb-8 text-lg font-semibold tracking-tight">
        DataBrief
      </Link>
      <nav className="flex flex-col gap-1">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

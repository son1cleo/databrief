"use client";

import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { MobileNav } from "./MobileNav";
import { NAV_LINKS } from "./nav-links";

interface NavbarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  plan?: string;
}

function useBreadcrumb(pathname: string) {
  const match = NAV_LINKS.find((link) => pathname.startsWith(link.href));
  return match?.label ?? "Dashboard";
}

export function Navbar({ user, plan }: NavbarProps) {
  const pathname = usePathname();
  const breadcrumb = useBreadcrumb(pathname);
  const initials = (user.name ?? user.email ?? "?").slice(0, 1).toUpperCase();

  return (
    <header className="flex h-12 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-3">
        <MobileNav />
        <span className="font-mono text-xs text-muted-foreground">
          databrief / {breadcrumb.toLowerCase()}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {plan && (
          <span className="rounded-full border border-brand/30 px-2 py-0.5 font-mono text-[10px] text-data-ink uppercase">
            {plan}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger className="outline-none">
            <Avatar className="size-8">
              <AvatarImage src={user.image ?? undefined} alt={user.name ?? ""} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5 text-sm">
              <p className="truncate font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/settings" />}>Settings</DropdownMenuItem>
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

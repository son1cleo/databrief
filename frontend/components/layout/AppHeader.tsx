"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, CircleQuestionMark } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MobileNav } from "./MobileNav";
import { NAV_LINKS } from "./nav-links";

interface AppHeaderProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  plan?: string;
}

/** Section title for the current route. Detail pages keep their parent
 * section's title here and render their own breadcrumb + hero below, so the
 * header stays a stable anchor while navigating within a section. */
function useSectionTitle(pathname: string) {
  return NAV_LINKS.find((link) => pathname.startsWith(link.href))?.label ?? "Dashboard";
}

export function AppHeader({ user, plan }: AppHeaderProps) {
  const pathname = usePathname();
  const title = useSectionTitle(pathname);
  const displayName = user.name ?? user.email ?? "Account";
  const initials = displayName.slice(0, 1).toUpperCase();

  return (
    <header className="px-4 pt-4 pb-4 md:px-6 md:pt-6">
      <div className="flex h-14 items-center justify-between gap-3 rounded-2xl border border-border-soft bg-surface px-3 shadow-card md:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <MobileNav />
          <h1 className="truncate font-display text-lg font-bold tracking-tight text-foreground md:text-xl">
            {title}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {plan && (
            <Badge variant="brand" className="hidden uppercase sm:inline-flex">
              {plan}
            </Badge>
          )}
          <Link
            href="/settings"
            aria-label="Help and settings"
            className="hidden size-9 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:flex"
          >
            <CircleQuestionMark className="size-4" />
          </Link>
          <button
            type="button"
            aria-label="Notifications"
            className="hidden size-9 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:flex"
          >
            <Bell className="size-4" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border border-border-soft bg-inset py-1 pr-2.5 pl-1 transition-colors duration-150 outline-none hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              <Avatar className="size-7">
                <AvatarImage src={user.image ?? undefined} alt="" />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <span className="hidden max-w-32 truncate text-sm font-medium text-foreground sm:inline">
                {displayName}
              </span>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="px-2 py-1.5">
                <p className="truncate text-sm font-medium">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/settings" />}>Settings</DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/settings/billing" />}>
                Billing &amp; plan
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

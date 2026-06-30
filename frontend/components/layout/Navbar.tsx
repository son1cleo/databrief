"use client";

import { signOut } from "next-auth/react";
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

interface NavbarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function Navbar({ user }: NavbarProps) {
  const initials = (user.name ?? user.email ?? "?").slice(0, 1).toUpperCase();

  return (
    <header className="flex h-16 items-center justify-between border-b border-border px-4 md:px-6">
      <MobileNav />
      <DropdownMenu>
        <DropdownMenuTrigger className="outline-none">
          <Avatar className="size-8">
            <AvatarImage src={user.image ?? undefined} alt={user.name ?? ""} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-2 py-1.5 text-sm">
            <p className="font-medium truncate">{user.name}</p>
            <p className="text-text-muted truncate text-xs">{user.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/settings" />}>
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

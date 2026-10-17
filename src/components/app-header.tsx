"use client";

import { LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { NavLink } from "@/components/nav-link";
import { Button } from "@/components/ui";
import { t } from "@/lib/strings";

export type NavItem = { href: string; label: string };

type AppHeaderProps = {
  items: NavItem[];
  userName: string;
  roleLabel: string;
  logout: () => Promise<void>;
};

/** Sticky header with an inline nav on desktop and a hamburger menu on mobile. */
export function AppHeader({ items, userName, roleLabel, logout }: AppHeaderProps) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-10 border-b border-ink-200 bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-x-4 px-4 py-2.5">
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden"
          aria-expanded={open}
          aria-label={open ? t.nav.closeMenu : t.nav.openMenu}
          onClick={() => setOpen(!open)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
        <Link href="/" className="text-lg font-bold tracking-tight text-primary">
          {t.appName}
        </Link>
        <nav className="hidden gap-1 sm:flex">
          {items.map((item) => (
            <NavLink key={item.href} href={item.href}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground md:inline">
            {userName} · {roleLabel}
          </span>
          <form action={logout}>
            <Button type="submit" variant="destructive" size="sm" className="gap-2">
              <LogOut className="size-4" />
              <span className="hidden sm:inline">{t.nav.logout}</span>
              <span className="sr-only sm:hidden">{t.nav.logout}</span>
            </Button>
          </form>
        </div>
      </div>
      {open && (
        <div className="border-t border-ink-200 sm:hidden">
          <div className="mx-auto max-w-5xl space-y-1 px-4 py-3">
            {items.map((item) => (
              <Button
                key={item.href}
                asChild
                variant="ghost"
                className="h-10 w-full justify-start text-base"
                onClick={() => setOpen(false)}
              >
                <Link href={item.href}>{item.label}</Link>
              </Button>
            ))}
            <p className="px-3 pt-2 text-sm text-muted-foreground">
              {userName} · {roleLabel}
            </p>
          </div>
        </div>
      )}
    </header>
  );
}

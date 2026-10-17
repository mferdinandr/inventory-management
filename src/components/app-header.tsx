"use client";

import type { LucideIcon } from "lucide-react";
import { Home, LayoutGrid, LogOut, Menu, Package, ScanLine, Users, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { NavLink } from "@/components/nav-link";
import { RoleBadge } from "@/components/role-badge";
import { Button } from "@/components/ui";
import type { Role } from "@/lib/permissions";
import { t } from "@/lib/strings";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string };

type AppHeaderProps = {
  items: NavItem[];
  userName: string;
  role: Role;
  logout: () => Promise<void>;
};

const itemIcons: Record<string, LucideIcon> = {
  "/": Home,
  "/items": Package,
  "/scan": ScanLine,
  "/users": Users,
};

/** Sticky header with an inline nav on desktop and a full-width drawer on mobile. */
export function AppHeader({ items, userName, role, logout }: AppHeaderProps) {
  const [open, setOpen] = useState(false);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-ink-200 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-x-4 px-4 py-2.5">
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden"
            aria-expanded={open}
            aria-label={t.nav.openMenu}
            onClick={() => setOpen(true)}
          >
            <Menu className="size-5" />
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
            <span className="hidden items-center gap-2 md:flex">
              <span className="text-sm text-muted-foreground">{userName}</span>
              <RoleBadge role={role} />
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
      </header>

      {/* Mobile drawer: sibling of the header (which has backdrop-blur and would
          otherwise become the containing block for this fixed element). */}
      <div
        className={cn(
          "fixed inset-0 z-50 sm:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!open}
      >
        {/* biome-ignore lint: decorative backdrop; the close button is the keyboard-accessible control. */}
        <div
          className={cn(
            "absolute inset-0 bg-ink-950/40 backdrop-blur-sm transition-opacity duration-300 ease-out",
            open ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setOpen(false)}
        />
        <aside
          className={cn(
            "absolute inset-y-0 left-0 flex w-full flex-col bg-background shadow-2xl transition-transform duration-300 ease-out",
            open ? "translate-x-0" : "-translate-x-full",
          )}
          role="dialog"
          aria-label={t.appName}
        >
          <div className="flex items-center gap-4 border-b border-ink-200 px-4 py-2.5">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t.nav.closeMenu}
              onClick={() => setOpen(false)}
            >
              <X className="size-5" />
            </Button>
            <span className="text-lg font-bold tracking-tight text-primary">{t.appName}</span>
          </div>
          <nav className="flex flex-col gap-1 p-4">
            {items.map((item) => {
              const Icon = itemIcons[item.href] ?? LayoutGrid;
              return (
                <NavLink
                  key={item.href}
                  href={item.href}
                  className="h-12 w-full justify-start text-base"
                >
                  <Icon className="size-5" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
          <p className="mt-auto flex items-center gap-2 border-t border-ink-200 px-4 py-3 text-sm text-muted-foreground">
            {userName}
            <RoleBadge role={role} />
          </p>
        </aside>
      </div>
    </>
  );
}

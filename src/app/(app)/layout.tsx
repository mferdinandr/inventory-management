import { LogOut } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { NavLink } from "@/components/nav-link";
import { Button } from "@/components/ui";
import { roleAllows } from "@/lib/permissions";
import { t } from "@/lib/strings";
import { signOut } from "@/server/auth/config";
import { requireUser } from "@/server/auth/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Pages enforce the forced password change themselves; the layout must let that page render.
  const user = await requireUser({ allowPasswordChange: true });

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  const navItems = [
    { href: "/", label: t.nav.home },
    { href: "/items", label: t.nav.items },
    { href: "/scan", label: t.nav.scan },
    ...(roleAllows(user.role, "user.manage") ? [{ href: "/users", label: t.nav.users }] : []),
  ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-ink-200 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <Link href="/" className="text-lg font-bold tracking-tight text-primary">
            {t.appName}
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            {navItems.map((item) => (
              <NavLink key={item.href} href={item.href}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user.name} · {t.roles[user.role]}
            </span>
            <form action={logout}>
              <Button type="submit" variant="outline" size="sm" className="gap-2">
                <LogOut className="size-4" />
                <span className="hidden sm:inline">{t.nav.logout}</span>
                <span className="sr-only sm:hidden">{t.nav.logout}</span>
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}

import { LogOut } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
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
              <Button key={item.href} variant="ghost" className="h-9 text-base" asChild>
                <Link href={item.href}>{item.label}</Link>
              </Button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {user.name} · {t.roles[user.role]}
            </span>
            <form action={logout}>
              <Button type="submit" variant="outline" size="sm" className="gap-2">
                <LogOut className="size-4" />
                {t.nav.logout}
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}

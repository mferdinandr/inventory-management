import type { ReactNode } from "react";
import { AppHeader } from "@/components/app-header";
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
      <AppHeader
        items={navItems}
        userName={user.name}
        roleLabel={t.roles[user.role]}
        logout={logout}
      />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}

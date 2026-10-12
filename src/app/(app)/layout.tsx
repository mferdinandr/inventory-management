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

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="text-lg font-bold text-teal-800">
            {t.appName}
          </Link>
          <nav className="flex gap-4 text-base">
            <Link href="/" className="py-2 hover:underline">
              {t.nav.home}
            </Link>
            {roleAllows(user.role, "user.manage") && (
              <Link href="/users" className="py-2 hover:underline">
                {t.nav.users}
              </Link>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-slate-600">
            <span>
              {user.name} · {t.roles[user.role]}
            </span>
            <form action={logout}>
              <Button type="submit" variant="secondary">
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

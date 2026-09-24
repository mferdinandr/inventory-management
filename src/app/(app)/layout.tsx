import { LogOutIcon } from "lucide-react"
import type { ReactNode } from "react"
import { signOut } from "@/auth"
import { AppNav } from "@/components/app-nav"
import { Button } from "@/components/ui/button"
import { requireUser } from "@/server/tenant"

export default async function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  const user = await requireUser()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1">
        <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r border-border bg-card/50 p-4 md:flex">
          <div className="px-2">
            <p className="text-lg font-semibold tracking-tight">SIMASET</p>
            <p className="truncate text-sm text-muted-foreground">
              {user.organizationId ? "Inventaris Aset RS" : "Panel Operator"}
            </p>
          </div>
          <AppNav />
          <div className="mt-auto rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
            <p className="truncate font-medium text-foreground">{user.name}</p>
            <p className="truncate">{user.role}</p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-border bg-card/50 px-4 py-3 md:px-6">
            <p className="truncate text-lg font-semibold md:hidden">SIMASET</p>
            <div className="hidden text-sm text-muted-foreground md:block" />
            <form
              action={async () => {
                "use server"
                await signOut({ redirectTo: "/login" })
              }}
            >
              <Button type="submit" variant="outline" size="sm">
                <LogOutIcon />
                Keluar
              </Button>
            </form>
          </header>
          <div className="border-b border-border bg-card/30 p-2 md:hidden">
            <AppNav orientation="horizontal" />
          </div>
          <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  )
}

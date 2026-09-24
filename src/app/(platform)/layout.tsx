import { LogOutIcon } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { signOut } from "@/auth"
import { Button } from "@/components/ui/button"
import { requirePlatformOwner } from "@/server/tenant"

export default async function PlatformLayout({ children }: Readonly<{ children: ReactNode }>) {
  const user = await requirePlatformOwner()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between gap-3 border-b border-border bg-card/50 px-4 py-3 md:px-6">
        <Link href="/operator" className="min-w-0">
          <p className="text-lg font-semibold tracking-tight">SIMASET</p>
          <p className="truncate text-sm text-muted-foreground">Panel Operator · {user.name}</p>
        </Link>
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
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6 lg:p-8">{children}</main>
    </div>
  )
}

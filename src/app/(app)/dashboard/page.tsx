import { signOut } from "@/auth"
import { requireUser } from "@/server/tenant"

export default async function DashboardPage() {
  const user = await requireUser()

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-center justify-between rounded-xl border bg-card p-4">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {user.name} — {user.email}
          </p>
          <span className="mt-1 inline-block rounded bg-muted px-2 py-0.5 text-xs font-medium">
            {user.role}
            {user.organizationId ? undefined : " (platform)"}
          </span>
        </div>
        <form
          action={async () => {
            "use server"
            await signOut({ redirectTo: "/login" })
          }}
        >
          <button type="submit" className="rounded-md border bg-background px-3 py-2 text-sm">
            Keluar
          </button>
        </form>
      </header>
      <p className="text-sm text-muted-foreground">
        Fondasi M0 sudah berdiri — skema, RLS, dan autentikasi aktif. Halaman kerja (aset, riwayat,
        peminjaman) menyusul per milestone。
      </p>
    </main>
  )
}

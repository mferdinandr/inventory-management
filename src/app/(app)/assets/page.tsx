import Link from "next/link"
import { Button } from "@/components/ui/button"
import { hasPermission } from "@/lib/permissions"
import { listAssets } from "@/server/services/asset.service"
import { requireActiveOrg, requireUser } from "@/server/tenant"

export const dynamic = "force-dynamic"

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Tersedia",
  IN_USE: "Sedang dipakai",
  ON_LOAN: "Sedang dipinjam",
  UNDER_REPAIR: "Dalam perbaikan",
  AT_VENDOR: "Di vendor",
  DAMAGED: "Rusak",
  LOST: "Hilang",
  DISPOSED: "Dihapuskan",
}

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; scan?: string }>
}) {
  const { q, scan } = await searchParams
  const user = await requireUser()
  const organizationId = await requireActiveOrg()
  const canCreate = hasPermission(user.role, "asset:create")
  const canDispose = hasPermission(user.role, "asset:dispose")

  const { items } = await listAssets(organizationId, { q })

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Aset</h1>
          <p className="text-sm text-muted-foreground">Seluruh aset organisasi Anda.</p>
        </div>
        <div className="flex gap-2">
          {canDispose ? (
            <Button
              variant="outline"
              render={<Link href="/assets/disposed">Aset Dihapuskan</Link>}
            />
          ) : null}
          {canCreate ? <Button render={<Link href="/assets/new">Daftarkan Aset</Link>} /> : null}
        </div>
      </header>

      {scan ? (
        <p className="rounded-md border bg-muted/50 p-2 text-xs text-muted-foreground">
          Dipindai: <span className="font-mono">{scan}</span> — cari kode asetnya di daftar di
          bawah.
        </p>
      ) : null}

      <form className="max-w-sm">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Cari nama, kode, nomor seri…"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </form>

      {items.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          Belum ada aset yang cocok.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Kode</th>
                <th className="px-3 py-2">Nama</th>
                <th className="px-3 py-2">Ruangan</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link href={`/assets/${a.id}`} className="hover:underline">
                      {a.assetCode}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{a.name}</td>
                  <td className="px-3 py-2">{a.locationName}</td>
                  <td className="px-3 py-2">{STATUS_LABELS[a.status] ?? a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

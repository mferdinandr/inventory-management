import { redirect } from "next/navigation"
import { AssetForm } from "@/components/assets/asset-form"
import { hasPermission } from "@/lib/permissions"
import { withOrg } from "@/server/db"
import { requireActiveOrg, requireUser } from "@/server/tenant"

export const dynamic = "force-dynamic"

export default async function NewAssetPage() {
  const user = await requireUser()
  if (!hasPermission(user.role, "asset:create")) redirect("/assets")
  const organizationId = await requireActiveOrg()

  const [categories, rooms] = await withOrg(organizationId, async (tx) => {
    const cats = await tx.category.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    })
    const locs = await tx.location.findMany({
      where: { organizationId, type: "ROOM", isActive: true },
      orderBy: { name: "asc" },
      include: {
        parent: { include: { parent: { include: { parent: true } } } },
      },
    })
    return [cats, locs] as const
  })

  if (categories.length === 0) {
    return (
      <div className="max-w-2xl space-y-3 rounded-xl border bg-card p-6 text-sm">
        <h1 className="text-lg font-semibold">Belum ada kategori</h1>
        <p className="text-muted-foreground">
          Buat kategori aset terlebih dahulu di Pengaturan → Kategori sebelum mendaftarkan aset.
        </p>
      </div>
    )
  }
  if (rooms.length === 0) {
    return (
      <div className="max-w-2xl space-y-3 rounded-xl border bg-card p-6 text-sm">
        <h1 className="text-lg font-semibold">Belum ada ruangan</h1>
        <p className="text-muted-foreground">
          Buat struktur lokasi hingga tingkat Ruangan terlebih dahulu di Pengaturan → Lokasi.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Daftarkan Aset Baru</h1>
        <p className="text-sm text-muted-foreground">
          Kode aset dan QR akan dibuat otomatis setelah disimpan.
        </p>
      </header>
      <AssetForm
        categories={categories.map((c) => ({ id: c.id, label: c.name }))}
        rooms={rooms.map((r) => ({
          id: r.id,
          label: [r.parent?.parent?.parent?.name, r.parent?.parent?.name, r.parent?.name, r.name]
            .filter(Boolean)
            .join(" / "),
        }))}
      />
    </div>
  )
}

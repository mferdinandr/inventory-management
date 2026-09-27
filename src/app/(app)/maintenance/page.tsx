import Link from "next/link"
import { ExportCsvButton } from "@/components/maintenance/export-csv-button"
import { hasPermission } from "@/lib/permissions"
import { withOrg } from "@/server/db"
import { listDueSchedules } from "@/server/services/maintenance.service"
import { requireActiveOrg, requireUser } from "@/server/tenant"

export const dynamic = "force-dynamic"

const TYPE_LABELS: Record<string, string> = {
  CALIBRATION: "Kalibrasi",
  PREVENTIVE: "Pemeliharaan preventif",
  CORRECTIVE: "Perbaikan korektif",
}

const BUCKETS: Array<{ key: string; label: string }> = [
  { key: "OVERDUE", label: "Sudah lewat" },
  { key: "DUE_7", label: "Jatuh tempo 7 hari ke depan" },
  { key: "DUE_30", label: "Jatuh tempo 30 hari ke depan" },
  { key: "DUE_90", label: "Jatuh tempo 90 hari ke depan" },
]

/** FR-23: dashboard jatuh tempo kalibrasi/pemeliharaan, dikelompokkan dan dapat difilter. */
export default async function MaintenanceDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ departmentId?: string; categoryId?: string }>
}) {
  const { departmentId, categoryId } = await searchParams
  const user = await requireUser()
  if (!hasPermission(user.role, "event:maintenance")) {
    return (
      <div className="max-w-2xl rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        Anda tidak memiliki izin melihat halaman ini.
      </div>
    )
  }
  const organizationId = await requireActiveOrg()

  const [departments, categories, rows] = await Promise.all([
    withOrg(organizationId, (tx) =>
      tx.location.findMany({
        where: { organizationId, type: "DEPARTMENT", isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ),
    withOrg(organizationId, (tx) =>
      tx.category.findMany({
        where: { organizationId, isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ),
    listDueSchedules(organizationId, { departmentId, categoryId }),
  ])

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Pemeliharaan</h1>
          <p className="text-sm text-muted-foreground">
            Jadwal kalibrasi dan pemeliharaan preventif yang mendekati atau sudah lewat jatuh tempo.
          </p>
        </div>
        <ExportCsvButton rows={rows} />
      </header>

      <form className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="departmentId" className="block text-sm text-muted-foreground">
            Instalasi
          </label>
          <select
            id="departmentId"
            name="departmentId"
            defaultValue={departmentId ?? ""}
            className="h-10 rounded-md border border-input bg-background px-3 text-base"
          >
            <option value="">Semua instalasi</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="categoryId" className="block text-sm text-muted-foreground">
            Kategori
          </label>
          <select
            id="categoryId"
            name="categoryId"
            defaultValue={categoryId ?? ""}
            className="h-10 rounded-md border border-input bg-background px-3 text-base"
          >
            <option value="">Semua kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="h-10 rounded-md border border-input bg-background px-4 text-base hover:bg-muted"
        >
          Terapkan
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          Tidak ada jadwal yang cocok dengan filter ini.
        </p>
      ) : (
        BUCKETS.map((bucket) => {
          const bucketRows = rows.filter((r) => r.bucket === bucket.key)
          if (bucketRows.length === 0) return null
          return (
            <section key={bucket.key} className="space-y-2">
              <h2 className="text-sm font-semibold">
                {bucket.label} <span className="text-muted-foreground">({bucketRows.length})</span>
              </h2>
              <div className="overflow-x-auto rounded-xl border bg-card">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Kode</th>
                      <th className="px-3 py-2">Nama</th>
                      <th className="px-3 py-2">Ruangan</th>
                      <th className="px-3 py-2">Jenis</th>
                      <th className="px-3 py-2">Jatuh tempo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bucketRows.map((r) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2 font-mono text-xs">
                          <Link href={`/assets/${r.assetId}`} className="hover:underline">
                            {r.assetCode}
                          </Link>
                        </td>
                        <td className="px-3 py-2">{r.assetName}</td>
                        <td className="px-3 py-2">{r.locationName}</td>
                        <td className="px-3 py-2">{TYPE_LABELS[r.type] ?? r.type}</td>
                        <td className="px-3 py-2">
                          {new Date(r.nextDueAt).toLocaleDateString("id-ID")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}

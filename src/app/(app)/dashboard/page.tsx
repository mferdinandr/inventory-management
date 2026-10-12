import Link from "next/link"
import { getDashboardStats } from "@/server/services/dashboard.service"
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
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  CREATED: "Didaftarkan",
  INSPECTION: "Inspeksi",
  MAINTENANCE: "Pemeliharaan",
  REPAIR: "Perbaikan",
  CALIBRATION: "Kalibrasi",
  LOAN_OUT: "Dipinjam",
  LOAN_RETURN: "Dikembalikan",
  TRANSFER: "Mutasi",
  STATUS_CHANGE: "Ubah status",
  NOTE: "Catatan",
  DISPOSAL: "Dihapuskan",
  CORRECTION: "Koreksi",
  LABEL_PRINTED: "Cetak label",
}

/** FR-26: dashboard ringkas per peran — PIC_ROOM hanya melihat cakupan ruangannya. */
export default async function DashboardPage() {
  const user = await requireUser()
  const organizationId = await requireActiveOrg()
  const stats = await getDashboardStats(organizationId, user.id, user.role)

  const totalAssets = stats.assetsByStatus.reduce((sum, s) => sum + s.count, 0)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Ringkasan kondisi aset organisasi Anda.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total aset</p>
          <p className="text-2xl font-semibold">{totalAssets}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Dalam perbaikan</p>
          <p className="text-2xl font-semibold">{stats.underRepairCount}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Peminjaman aktif</p>
          <p className="text-2xl font-semibold">{stats.loans.active}</p>
        </div>
        <div className="rounded-xl border bg-destructive/10 p-4">
          <p className="text-sm text-destructive">Peminjaman telat</p>
          <p className="text-2xl font-semibold text-destructive">{stats.loans.overdue}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Aset per status</h2>
          <ul className="space-y-1 text-sm">
            {stats.assetsByStatus.map((s) => (
              <li key={s.status} className="flex items-center justify-between">
                <span>{STATUS_LABELS[s.status] ?? s.status}</span>
                <span className="font-medium">{s.count}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Aset per instalasi</h2>
          <ul className="space-y-1 text-sm">
            {stats.assetsByDepartment.map((d) => (
              <li key={d.departmentName} className="flex items-center justify-between">
                <span>{d.departmentName}</span>
                <span className="font-medium">{d.count}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Kalibrasi jatuh tempo (30 hari)</h2>
            <Link href="/maintenance" className="text-xs text-primary hover:underline">
              Lihat semua
            </Link>
          </div>
          {stats.dueCalibrations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada yang jatuh tempo.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {stats.dueCalibrations.map((c) => (
                <li key={c.assetId} className="flex items-center justify-between gap-2">
                  <Link href={`/assets/${c.assetId}`} className="truncate hover:underline">
                    {c.assetCode} — {c.assetName}
                  </Link>
                  <span
                    className={
                      c.isOverdue ? "shrink-0 text-destructive" : "shrink-0 text-muted-foreground"
                    }
                  >
                    {new Date(c.nextDueAt).toLocaleDateString("id-ID")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Aktivitas terakhir</h2>
          {stats.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada aktivitas.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {stats.recentActivity.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    <span className="text-muted-foreground">
                      {EVENT_TYPE_LABELS[e.type] ?? e.type}
                    </span>{" "}
                    {e.assetCode} — {e.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(e.occurredAt).toLocaleDateString("id-ID")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

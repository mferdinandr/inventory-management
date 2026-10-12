import Link from "next/link"
import { hasPermission } from "@/lib/permissions"
import { withOrg } from "@/server/db"
import {
  getCalibrationReport,
  getLoanReport,
  getLostDisposedReport,
  getRoomInventoryReport,
} from "@/server/services/reports.service"
import { requireActiveOrg, requireUser } from "@/server/tenant"

export const dynamic = "force-dynamic"

const REPORT_TYPES = [
  { key: "room-inventory", label: "Daftar aset per ruangan" },
  { key: "loans", label: "Rekap peminjaman" },
  { key: "calibration", label: "Rekap kalibrasi" },
  { key: "lost-disposed", label: "Aset hilang dan dihapuskan" },
] as const

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function monthAgoIso(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 10)
}

function ExportLinks({ query }: { query: string }) {
  return (
    <div className="flex gap-2">
      <a
        href={`/api/reports/export?${query}&format=xlsx`}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted"
      >
        Ekspor Excel
      </a>
      <a
        href={`/api/reports/export?${query}&format=csv`}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted"
      >
        Ekspor CSV
      </a>
    </div>
  )
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; roomId?: string; from?: string; to?: string }>
}) {
  const params = await searchParams
  const type = params.type ?? "room-inventory"
  const user = await requireUser()
  if (!hasPermission(user.role, "report:view")) {
    return (
      <div className="max-w-2xl rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        Anda tidak memiliki izin melihat halaman ini.
      </div>
    )
  }
  const organizationId = await requireActiveOrg()

  const rooms = await withOrg(organizationId, (tx) =>
    tx.location.findMany({
      where: { organizationId, type: "ROOM", isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  )

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Laporan</h1>
        <p className="text-sm text-muted-foreground">
          Pratinjau dan ekspor Excel/CSV untuk laporan-laporan berikut.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2">
        {REPORT_TYPES.map((r) => (
          <Link
            key={r.key}
            href={`/reports?type=${r.key}`}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              type === r.key ? "border-primary bg-primary text-primary-foreground" : "border-border"
            }`}
          >
            {r.label}
          </Link>
        ))}
      </nav>

      {type === "room-inventory" ? (
        <RoomInventorySection
          organizationId={organizationId}
          rooms={rooms}
          roomId={params.roomId}
        />
      ) : type === "loans" ? (
        <LoansSection
          organizationId={organizationId}
          from={params.from ?? monthAgoIso()}
          to={params.to ?? todayIso()}
        />
      ) : type === "calibration" ? (
        <CalibrationSection
          organizationId={organizationId}
          from={params.from ?? monthAgoIso()}
          to={params.to ?? todayIso()}
        />
      ) : (
        <LostDisposedSection organizationId={organizationId} />
      )}
    </div>
  )
}

async function RoomInventorySection({
  organizationId,
  rooms,
  roomId,
}: {
  organizationId: string
  rooms: Array<{ id: string; name: string }>
  roomId?: string
}) {
  const selectedRoomId = roomId ?? rooms[0]?.id
  const rows = selectedRoomId ? await getRoomInventoryReport(organizationId, selectedRoomId) : []

  return (
    <section className="space-y-3">
      <form className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="type" value="room-inventory" />
        <div className="space-y-1">
          <label htmlFor="roomId" className="block text-sm text-muted-foreground">
            Ruangan
          </label>
          <select
            id="roomId"
            name="roomId"
            defaultValue={selectedRoomId}
            className="h-10 rounded-md border border-input bg-background px-3 text-base"
          >
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="h-10 rounded-md border border-input bg-background px-4 text-base hover:bg-muted"
        >
          Tampilkan
        </button>
        {selectedRoomId ? (
          <ExportLinks query={`type=room-inventory&roomId=${selectedRoomId}`} />
        ) : null}
      </form>

      <ReportTable
        columns={["Kode", "Nama", "Kategori", "Kondisi", "Status"]}
        rows={rows.map((r) => [r.assetCode, r.name, r.categoryName ?? "—", r.condition, r.status])}
      />
    </section>
  )
}

async function LoansSection({
  organizationId,
  from,
  to,
}: {
  organizationId: string
  from: string
  to: string
}) {
  const rows = await getLoanReport(organizationId, {
    from: new Date(from),
    to: new Date(`${to}T23:59:59`),
  })

  return (
    <section className="space-y-3">
      <DateRangeForm type="loans" from={from} to={to} />
      <ReportTable
        columns={["Aset", "Peminjam", "Keperluan", "Dipinjam", "Dikembalikan"]}
        rows={rows.map((r) => [
          `${r.assetCode} — ${r.assetName}`,
          r.borrowerLabel,
          r.purpose,
          r.borrowedAt.toLocaleDateString("id-ID"),
          r.returnedAt ? r.returnedAt.toLocaleDateString("id-ID") : "Belum dikembalikan",
        ])}
      />
    </section>
  )
}

async function CalibrationSection({
  organizationId,
  from,
  to,
}: {
  organizationId: string
  from: string
  to: string
}) {
  const rows = await getCalibrationReport(organizationId, {
    from: new Date(from),
    to: new Date(`${to}T23:59:59`),
  })
  const RESULT_LABELS: Record<string, string> = {
    PASS: "Lulus",
    PASS_WITH_NOTE: "Lulus bersyarat",
    FAIL: "Tidak lulus",
  }

  return (
    <section className="space-y-3">
      <DateRangeForm type="calibration" from={from} to={to} />
      <ReportTable
        columns={["Aset", "Tanggal", "Pelaksana", "Hasil", "Berlaku sampai"]}
        rows={rows.map((r) => [
          `${r.assetCode} — ${r.assetName}`,
          r.performedAt.toLocaleDateString("id-ID"),
          r.performedBy,
          RESULT_LABELS[r.result] ?? r.result,
          r.validUntil ? r.validUntil.toLocaleDateString("id-ID") : "—",
        ])}
      />
    </section>
  )
}

async function LostDisposedSection({ organizationId }: { organizationId: string }) {
  const rows = await getLostDisposedReport(organizationId)
  const STATUS_LABELS: Record<string, string> = { LOST: "Hilang", DISPOSED: "Dihapuskan" }

  return (
    <section className="space-y-3">
      <ExportLinks query="type=lost-disposed" />
      <ReportTable
        columns={["Kode", "Nama", "Status", "Alasan", "Tanggal"]}
        rows={rows.map((r) => [
          r.assetCode,
          r.name,
          STATUS_LABELS[r.status] ?? r.status,
          r.disposalReason ?? "—",
          r.disposedAt ? r.disposedAt.toLocaleDateString("id-ID") : "—",
        ])}
      />
    </section>
  )
}

function DateRangeForm({ type, from, to }: { type: string; from: string; to: string }) {
  return (
    <form className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="type" value={type} />
      <div className="space-y-1">
        <label htmlFor="from" className="block text-sm text-muted-foreground">
          Dari
        </label>
        <input
          id="from"
          type="date"
          name="from"
          defaultValue={from}
          className="h-10 rounded-md border border-input bg-background px-3 text-base"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="to" className="block text-sm text-muted-foreground">
          Sampai
        </label>
        <input
          id="to"
          type="date"
          name="to"
          defaultValue={to}
          className="h-10 rounded-md border border-input bg-background px-3 text-base"
        />
      </div>
      <button
        type="submit"
        className="h-10 rounded-md border border-input bg-background px-4 text-base hover:bg-muted"
      >
        Tampilkan
      </button>
      <ExportLinks query={`type=${type}&from=${from}&to=${to}`} />
    </form>
  )
}

function ReportTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        Tidak ada data untuk ditampilkan.
      </p>
    )
  }
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-3 py-2">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: baris laporan hanya-baca, tanpa id stabil
            <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
              {row.map((cell, j) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: sel laporan hanya-baca, tanpa id stabil
                <td key={j} className="px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

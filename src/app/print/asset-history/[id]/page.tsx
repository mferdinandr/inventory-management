import { notFound } from "next/navigation"
import { PrintButton } from "@/components/print-button"
import { withOrg } from "@/server/db"
import { requireActiveOrg, requireUser } from "@/server/tenant"

// FR-27 (docs/02-prd.md §H): riwayat aset lengkap untuk satu aset, dapat
// dicetak. Route top-level di luar app shell (docs/04 §3), sama seperti /print/label.
export const dynamic = "force-dynamic"

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

export default async function PrintAssetHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await requireUser()
  const organizationId = await requireActiveOrg()

  const asset = await withOrg(organizationId, (tx) =>
    tx.asset.findFirst({
      where: { id, organizationId },
      include: {
        category: { select: { name: true } },
        location: { select: { name: true } },
        organization: { select: { name: true } },
        events: {
          orderBy: { occurredAt: "asc" },
          include: { recordedByUser: { select: { name: true } } },
        },
      },
    }),
  )
  if (!asset) notFound()

  return (
    <div className="min-h-screen bg-white p-6 text-black print:p-0">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <header className="mb-6 border-b border-black pb-3">
        <p className="text-sm">{asset.organization?.name}</p>
        <h1 className="text-xl font-bold">Riwayat Lengkap Aset</h1>
      </header>

      <dl className="mb-6 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-gray-600">Kode Aset</dt>
          <dd className="font-mono font-medium">{asset.assetCode}</dd>
        </div>
        <div>
          <dt className="text-gray-600">Nama</dt>
          <dd className="font-medium">{asset.name}</dd>
        </div>
        <div>
          <dt className="text-gray-600">Kategori</dt>
          <dd>{asset.category?.name ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-600">Ruangan saat ini</dt>
          <dd>{asset.location.name}</dd>
        </div>
        <div>
          <dt className="text-gray-600">Merek / Model</dt>
          <dd>{[asset.brand, asset.model].filter(Boolean).join(" / ") || "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-600">Nomor Seri</dt>
          <dd>{asset.serialNumber ?? "—"}</dd>
        </div>
      </dl>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-1 pr-2">Tanggal</th>
            <th className="py-1 pr-2">Jenis</th>
            <th className="py-1 pr-2">Judul</th>
            <th className="py-1 pr-2">Catatan</th>
            <th className="py-1">Pencatat</th>
          </tr>
        </thead>
        <tbody>
          {asset.events.map((e) => (
            <tr key={e.id} className="border-b border-gray-300 align-top">
              <td className="py-1 pr-2 whitespace-nowrap">
                {e.occurredAt.toLocaleDateString("id-ID")}
              </td>
              <td className="py-1 pr-2">{EVENT_TYPE_LABELS[e.type] ?? e.type}</td>
              <td className="py-1 pr-2">{e.title}</td>
              <td className="py-1 pr-2">{e.notes ?? "—"}</td>
              <td className="py-1">{e.recordedByUser?.name ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-8 text-xs text-gray-500">
        Dicetak {new Date().toLocaleString("id-ID")} dari SIMASET.
      </p>
    </div>
  )
}

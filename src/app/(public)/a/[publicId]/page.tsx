import { notFound, redirect } from "next/navigation"
import { auth } from "@/auth"
import { getPublicAsset } from "@/server/services/public-asset.service"

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Tersedia",
  IN_USE: "Sedang dipakai",
  ON_LOAN: "Sedang dipinjam",
  UNDER_REPAIR: "Dalam perbaikan",
  AT_VENDOR: "Di vendor",
  DAMAGED: "Rusak",
  LOST: "Hilang",
  DISPOSED: "Telah dihapuskan",
}

const CONDITION_LABELS: Record<string, string> = {
  GOOD: "Baik",
  MINOR_ISSUE: "Ada catatan kecil",
  NEEDS_REPAIR: "Perlu diperbaiki",
  UNUSABLE: "Tidak dapat dipakai",
}

const EVENT_LABELS: Record<string, string> = {
  CREATED: "Aset didaftarkan",
  INSPECTION: "Pengecekan",
  MAINTENANCE: "Pemeliharaan",
  REPAIR: "Perbaikan",
  CALIBRATION: "Kalibrasi",
  LOAN_OUT: "Dipinjamkan",
  LOAN_RETURN: "Dikembalikan",
  TRANSFER: "Mutasi ruangan",
  STATUS_CHANGE: "Perubahan status",
  NOTE: "Catatan",
  DISPOSAL: "Dihapuskan",
  CORRECTION: "Koreksi",
  LABEL_PRINTED: "Label dicetak",
}

// FR-24 (docs/02-prd.md §G). Tanpa sesi: informasi terbatas. Dengan sesi
// yang berwenang: alihkan ke tampilan penuh — halaman detail aset belum ada
// di M2 tahap ini, jadi pengalihan itu menyusul begitu /assets/[id] ada.
export default async function PublicAssetPage({
  params,
}: {
  params: Promise<{ publicId: string }>
}) {
  const { publicId } = await params
  const asset = await getPublicAsset(publicId)

  // FR-24: public_id tak dikenal → 404 netral, tanpa membocorkan apa pun
  // (bukan pesan khusus yang membedakan "tidak ada" dari alasan lain).
  if (!asset) notFound()

  const session = await auth()
  if (session?.user?.organizationId) {
    // FR-24: pengguna yang sudah login dan berwenang langsung diarahkan ke
    // tampilan penuh. Halaman /assets sendiri yang menyelesaikan publicId
    // lewat sesi (RLS-bound) miliknya — bukan lewat data publik di atas.
    redirect(`/assets?scan=${publicId}`)
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg space-y-4 bg-muted p-4">
      <div className="space-y-1 rounded-xl border bg-card p-4 text-center shadow-sm">
        <p className="text-xs font-medium text-muted-foreground">{asset.organizationName}</p>
        <h1 className="text-xl font-semibold tracking-tight">{asset.name}</h1>
        <p className="font-mono text-sm text-muted-foreground">{asset.assetCode}</p>
      </div>

      {asset.isDisposed ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-center text-sm text-destructive">
          Aset ini telah dihapuskan dari inventaris.
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 rounded-xl border bg-card p-4 text-sm shadow-sm">
        <div>
          <dt className="text-muted-foreground">Status</dt>
          <dd className="font-medium">{STATUS_LABELS[asset.status] ?? asset.status}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Kondisi</dt>
          <dd className="font-medium">{CONDITION_LABELS[asset.condition] ?? asset.condition}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Kategori</dt>
          <dd className="font-medium">{asset.categoryName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Merek / model</dt>
          <dd className="font-medium">
            {[asset.brand, asset.model].filter(Boolean).join(" / ") || "—"}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted-foreground">Ruangan</dt>
          <dd className="font-medium">{asset.locationName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Penanggung jawab ruangan</dt>
          <dd className="font-medium">{asset.picName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Kalibrasi berikutnya</dt>
          <dd className="font-medium">{asset.nextCalibrationDue ?? "—"}</dd>
        </div>
      </dl>

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">Riwayat terbaru</h2>
        {asset.recentEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada riwayat.</p>
        ) : (
          <ul className="space-y-2">
            {asset.recentEvents.map((e) => (
              <li key={e.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span>
                  <span className="font-medium">{EVENT_LABELS[e.type] ?? e.type}</span>
                  {e.title && e.title !== EVENT_LABELS[e.type] ? (
                    <span className="text-muted-foreground"> — {e.title}</span>
                  ) : null}
                </span>
                <time className="shrink-0 text-xs text-muted-foreground">
                  {new Date(e.occurredAt).toLocaleDateString("id-ID")}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>

      <a
        href={`/login?callbackUrl=${encodeURIComponent(`/a/${publicId}`)}`}
        className="block rounded-md border bg-card px-3 py-2 text-center text-sm font-medium shadow-sm"
      >
        Masuk untuk detail lengkap
      </a>
    </main>
  )
}

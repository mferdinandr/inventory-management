import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getAssetDetail } from "@/server/services/asset.service"
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

export default async function AssetDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ created?: string }>
}) {
  const { id } = await params
  const { created } = await searchParams
  await requireUser()
  const organizationId = await requireActiveOrg()

  const asset = await getAssetDetail(organizationId, id)
  if (!asset) notFound()

  return (
    <div className="max-w-3xl space-y-6">
      {created ? (
        <p className="rounded-md border border-emerald-300 bg-emerald-50 p-2 text-sm text-emerald-800">
          Aset berhasil didaftarkan. Cetak labelnya sekarang sebelum lupa.
        </p>
      ) : null}

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{asset.name}</h1>
          <p className="font-mono text-sm text-muted-foreground">{asset.assetCode}</p>
        </div>
        <Link href="/assets" className="text-sm text-muted-foreground hover:underline">
          ← Kembali ke daftar
        </Link>
      </header>

      <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
        <div className="space-y-3 rounded-xl border bg-card p-4 text-center">
          <Image
            src={`/api/qr/${asset.publicId}`}
            alt={`QR ${asset.assetCode}`}
            width={160}
            height={160}
            unoptimized
          />
          <div className="flex flex-col gap-1 text-xs">
            <Link
              href={`/print/label/${asset.id}?size=50x30`}
              className="text-primary hover:underline"
            >
              Cetak label
            </Link>
            <Link
              href={`/a/${asset.publicId}`}
              target="_blank"
              className="text-muted-foreground hover:underline"
            >
              Lihat halaman publik
            </Link>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 rounded-xl border bg-card p-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium">{STATUS_LABELS[asset.status] ?? asset.status}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Kategori</dt>
            <dd className="font-medium">{asset.category?.name ?? "—"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted-foreground">Ruangan</dt>
            <dd className="font-medium">{asset.location.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Merek / model</dt>
            <dd className="font-medium">
              {[asset.brand, asset.model].filter(Boolean).join(" / ") || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Nomor seri</dt>
            <dd className="font-medium">{asset.serialNumber ?? "—"}</dd>
          </div>
        </dl>
      </div>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Riwayat</h2>
        {asset.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada riwayat.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {asset.events.map((e) => (
              <li key={e.id} className="flex items-baseline justify-between gap-3">
                <span>
                  <span className="font-medium">{e.title}</span>
                </span>
                <time className="shrink-0 text-xs text-muted-foreground">
                  {new Date(e.occurredAt).toLocaleDateString("id-ID")}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { DisposeDialog } from "@/components/assets/dispose-dialog"
import { EventForm } from "@/components/assets/event-form"
import { HistoryTimeline } from "@/components/assets/history-timeline"
import { RevertDisposalButton } from "@/components/assets/revert-disposal-button"
import { TransferForm } from "@/components/assets/transfer-form"
import { hasPermission } from "@/lib/permissions"
import { withOrg } from "@/server/db"
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
  const user = await requireUser()
  const organizationId = await requireActiveOrg()

  const asset = await getAssetDetail(organizationId, id)
  if (!asset) notFound()

  const canTransfer = hasPermission(user.role, "asset:transfer")
  const canDispose = hasPermission(user.role, "asset:dispose")
  const canRevert = hasPermission(user.role, "asset:revertDisposal")
  const canRecordEvent = hasPermission(user.role, "event:create")
  const isDisposed = asset.status === "DISPOSED"

  const rooms = isDisposed
    ? []
    : await withOrg(organizationId, (tx) =>
        tx.location.findMany({
          where: { organizationId, type: "ROOM", isActive: true, id: { not: asset.locationId } },
          orderBy: { name: "asc" },
          include: { parent: { include: { parent: { include: { parent: true } } } } },
        }),
      )

  const remainingRevertDays = asset.disposalRevertUntil
    ? Math.max(0, Math.ceil((asset.disposalRevertUntil.getTime() - Date.now()) / 86_400_000))
    : 0

  return (
    <div className="max-w-3xl space-y-6">
      {created ? (
        <p className="rounded-md border border-emerald-300 bg-emerald-50 p-2 text-sm text-emerald-800">
          Aset berhasil didaftarkan. Cetak labelnya sekarang sebelum lupa.
        </p>
      ) : null}

      {isDisposed ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <span>
            Aset telah dihapuskan pada {asset.disposedAt?.toLocaleDateString("id-ID")}.
            {asset.disposalRevertUntil && asset.disposalRevertUntil > new Date()
              ? ` Dapat dibatalkan dalam ${remainingRevertDays} hari lagi.`
              : " Masa pembatalan sudah lewat; penghapusan ini final."}
          </span>
          {canRevert && asset.disposalRevertUntil && asset.disposalRevertUntil > new Date() ? (
            <RevertDisposalButton assetId={asset.id} />
          ) : null}
        </div>
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

      {!isDisposed && (canRecordEvent || canTransfer || canDispose) ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {canRecordEvent ? <EventForm assetId={asset.id} /> : null}
          {canTransfer ? (
            <TransferForm
              assetId={asset.id}
              rooms={rooms.map((r) => ({
                id: r.id,
                label: [
                  r.parent?.parent?.parent?.name,
                  r.parent?.parent?.name,
                  r.parent?.name,
                  r.name,
                ]
                  .filter(Boolean)
                  .join(" / "),
              }))}
            />
          ) : null}
        </div>
      ) : null}

      {!isDisposed && canDispose ? (
        <div className="rounded-xl border border-destructive/30 bg-card p-4">
          <p className="mb-2 text-sm text-muted-foreground">
            Menghapuskan aset dapat dibatalkan dalam 30 hari.
          </p>
          <DisposeDialog assetId={asset.id} />
        </div>
      ) : null}

      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Riwayat</h2>
        <HistoryTimeline
          assetId={asset.id}
          events={asset.events.map((e) => ({
            id: e.id,
            type: e.type,
            title: e.title,
            notes: e.notes,
            occurredAt: e.occurredAt,
            recordedAt: e.recordedAt,
            recordedByUser: e.recordedByUser,
            statusBefore: e.statusBefore,
            statusAfter: e.statusAfter,
            attachments: e.attachments,
            corrections: e.corrections,
            correctsEvent: e.correctsEvent,
          }))}
        />
      </section>
    </div>
  )
}

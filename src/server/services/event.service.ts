import "server-only"
import { assertManualTransition, canRevertDisposal } from "@/lib/status-machine"
import type {
  DisposeAssetInput,
  HistoryEventInput,
  TransferAssetInput,
} from "@/lib/validators/event"
import { withOrg } from "@/server/db"
import { assertOrgWritable } from "@/server/quota"
import type { Prisma } from "../../../generated/prisma/client"
import type { AssetStatus } from "../../../generated/prisma/enums"

// FR-09/FR-10/FR-11/FR-15/FR-16 (docs/02-prd.md §B/§D). asset_events adalah
// satu-satunya jejak yang dipercaya — setiap fungsi di sini menulis tepat
// satu entri per mutasi status/lokasi, tidak pernah mengubah baris lama.

export class EventError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "EventError"
  }
}

type Tx = Prisma.TransactionClient

async function loadAssetOrThrow(tx: Tx, organizationId: string, assetId: string) {
  const asset = await tx.asset.findFirst({
    where: { id: assetId, organizationId },
    select: {
      id: true,
      status: true,
      locationId: true,
      statusBeforeDisposal: true,
      disposalRevertUntil: true,
    },
  })
  if (!asset) throw new EventError("Aset tidak ditemukan.")
  return asset
}

/**
 * FR-15: pencatatan riwayat manual (inspeksi, pemeliharaan, perbaikan,
 * kalibrasi, catatan bebas, atau perubahan status). `newStatus`, bila diisi,
 * divalidasi lewat status-machine sebelum ditulis — entri riwayat dan
 * perubahan status pada `assets` selalu dalam satu transaksi yang sama.
 */
export async function recordHistoryEvent(
  organizationId: string,
  actorUserId: string,
  input: HistoryEventInput,
): Promise<{ eventId: string }> {
  return withOrg(organizationId, async (tx) => {
    await assertOrgWritable(organizationId, tx)
    const asset = await loadAssetOrThrow(tx, organizationId, input.assetId)
    if (asset.status === "DISPOSED") {
      throw new EventError("Aset yang sudah dihapuskan tidak dapat dicatat riwayat barunya.")
    }

    let statusAfter: AssetStatus | undefined
    if (input.type === "STATUS_CHANGE") {
      if (!input.newStatus) throw new EventError("Status baru wajib dipilih.")
      assertManualTransition(asset.status, input.newStatus)
      statusAfter = input.newStatus
    }

    const event = await tx.assetEvent.create({
      data: {
        organizationId,
        assetId: input.assetId,
        type: input.type,
        title: input.title,
        notes: input.notes ?? null,
        occurredAt: input.occurredAt,
        recordedBy: actorUserId,
        locationId: asset.locationId,
        statusBefore: statusAfter ? asset.status : null,
        statusAfter: statusAfter ?? null,
      },
      select: { id: true },
    })

    if (statusAfter) {
      await tx.asset.update({ where: { id: input.assetId }, data: { status: statusAfter } })
    }

    return { eventId: event.id }
  })
}

/** FR-10: mutasi/transfer ruangan. PIC aset mengikuti PIC ruangan tujuan. */
export async function transferAsset(
  organizationId: string,
  actorUserId: string,
  input: TransferAssetInput,
): Promise<{ eventId: string }> {
  return withOrg(organizationId, async (tx) => {
    await assertOrgWritable(organizationId, tx)
    const asset = await loadAssetOrThrow(tx, organizationId, input.assetId)
    if (asset.status === "ON_LOAN") {
      throw new EventError("Aset yang sedang dipinjam tidak dapat dimutasi. Kembalikan dahulu.")
    }
    if (asset.status === "DISPOSED") {
      throw new EventError("Aset yang sudah dihapuskan tidak dapat dimutasi.")
    }

    const destination = await tx.location.findFirst({
      where: { id: input.toLocationId, organizationId, type: "ROOM" },
      select: { id: true, name: true, picUserId: true },
    })
    if (!destination) throw new EventError("Ruangan tujuan tidak ditemukan.")

    const event = await tx.assetEvent.create({
      data: {
        organizationId,
        assetId: input.assetId,
        type: "TRANSFER",
        title: `Mutasi ke ${destination.name}`,
        notes: input.reason,
        occurredAt: input.occurredAt,
        recordedBy: actorUserId,
        locationId: destination.id,
        metadata: { fromLocationId: asset.locationId, toLocationId: destination.id },
      },
      select: { id: true },
    })

    await tx.asset.update({
      where: { id: input.assetId },
      data: { locationId: destination.id, responsibleUserId: destination.picUserId },
    })

    return { eventId: event.id }
  })
}

const DISPOSAL_REVERT_WINDOW_DAYS = 30

/** FR-11: penghapusan aset — tidak pernah menghapus baris, hanya menandai. */
export async function disposeAsset(
  organizationId: string,
  actorUserId: string,
  input: DisposeAssetInput,
): Promise<{ eventId: string }> {
  return withOrg(organizationId, async (tx) => {
    await assertOrgWritable(organizationId, tx)
    const asset = await loadAssetOrThrow(tx, organizationId, input.assetId)
    if (asset.status === "ON_LOAN") {
      throw new EventError("Aset yang sedang dipinjam tidak dapat dihapuskan. Kembalikan dahulu.")
    }
    if (asset.status === "DISPOSED") {
      throw new EventError("Aset ini sudah dihapuskan.")
    }

    const revertUntil = new Date(input.occurredAt)
    revertUntil.setDate(revertUntil.getDate() + DISPOSAL_REVERT_WINDOW_DAYS)

    const event = await tx.assetEvent.create({
      data: {
        organizationId,
        assetId: input.assetId,
        type: "DISPOSAL",
        title: "Aset dihapuskan",
        notes: null,
        occurredAt: input.occurredAt,
        recordedBy: actorUserId,
        locationId: asset.locationId,
        statusBefore: asset.status,
        statusAfter: "DISPOSED",
        metadata: { reason: input.reason },
      },
      select: { id: true },
    })

    await tx.asset.update({
      where: { id: input.assetId },
      data: {
        status: "DISPOSED",
        disposalReason: input.reason,
        disposedAt: input.occurredAt,
        disposedRecordedAt: new Date(),
        disposalRevertUntil: revertUntil,
        statusBeforeDisposal: asset.status,
      },
    })

    return { eventId: event.id }
  })
}

/**
 * FR-11: pembatalan penghapusan dalam 30 hari. Mengembalikan status ke nilai
 * SEBELUM dihapuskan (bukan selalu AVAILABLE), dan mencatat pembatalan itu
 * sendiri sebagai entri CORRECTION.
 */
export async function revertDisposal(
  organizationId: string,
  actorUserId: string,
  assetId: string,
): Promise<{ eventId: string }> {
  return withOrg(organizationId, async (tx) => {
    await assertOrgWritable(organizationId, tx)
    const asset = await loadAssetOrThrow(tx, organizationId, assetId)
    if (asset.status !== "DISPOSED") throw new EventError("Aset ini tidak dalam status dihapuskan.")
    if (!asset.disposalRevertUntil || asset.disposalRevertUntil < new Date()) {
      throw new EventError("Masa pembatalan 30 hari sudah lewat. Penghapusan ini sudah final.")
    }
    if (!canRevertDisposal(asset.statusBeforeDisposal)) {
      throw new EventError("Status sebelum dihapuskan tidak valid untuk dipulihkan.")
    }
    const restoredStatus = asset.statusBeforeDisposal!

    const event = await tx.assetEvent.create({
      data: {
        organizationId,
        assetId,
        type: "CORRECTION",
        title: "Pembatalan penghapusan aset",
        notes: "Penghapusan dibatalkan dalam masa 30 hari.",
        occurredAt: new Date(),
        recordedBy: actorUserId,
        locationId: asset.locationId,
        statusBefore: "DISPOSED",
        statusAfter: restoredStatus,
      },
      select: { id: true },
    })

    await tx.asset.update({
      where: { id: assetId },
      data: {
        status: restoredStatus,
        disposalReason: null,
        disposedAt: null,
        disposedRecordedAt: null,
        disposalRevertUntil: null,
        statusBeforeDisposal: null,
      },
    })

    return { eventId: event.id }
  })
}

/** FR-16: entri CORRECTION menunjuk satu entri lama; entri lama tetap tampil apa adanya. */
export async function correctEvent(
  organizationId: string,
  actorUserId: string,
  eventId: string,
  reason: string,
): Promise<{ eventId: string }> {
  return withOrg(organizationId, async (tx) => {
    await assertOrgWritable(organizationId, tx)
    const original = await tx.assetEvent.findFirst({
      where: { id: eventId, organizationId },
      select: { id: true, assetId: true, locationId: true },
    })
    if (!original) throw new EventError("Entri riwayat tidak ditemukan.")

    const correction = await tx.assetEvent.create({
      data: {
        organizationId,
        assetId: original.assetId,
        type: "CORRECTION",
        title: "Koreksi entri riwayat",
        notes: reason,
        occurredAt: new Date(),
        recordedBy: actorUserId,
        locationId: original.locationId,
        correctsEventId: original.id,
      },
      select: { id: true },
    })

    return { eventId: correction.id }
  })
}

export type DisposedAssetRow = {
  id: string
  assetCode: string
  name: string
  disposedAt: Date | null
  disposalRevertUntil: Date | null
  remainingDays: number
}

/** FR-11: halaman "Aset Dihapuskan" — hanya yang masih dalam masa pembatalan tampak di sini. */
export async function listDisposedAssets(organizationId: string): Promise<DisposedAssetRow[]> {
  return withOrg(organizationId, async (tx) => {
    const rows = await tx.asset.findMany({
      where: { organizationId, status: "DISPOSED", disposalRevertUntil: { gte: new Date() } },
      orderBy: { disposedAt: "desc" },
      select: {
        id: true,
        assetCode: true,
        name: true,
        disposedAt: true,
        disposalRevertUntil: true,
      },
    })
    const now = Date.now()
    return rows.map((r) => ({
      ...r,
      remainingDays: r.disposalRevertUntil
        ? Math.max(0, Math.ceil((r.disposalRevertUntil.getTime() - now) / 86_400_000))
        : 0,
    }))
  })
}

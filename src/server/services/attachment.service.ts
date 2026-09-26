import "server-only"
import type { ConfirmAttachmentInput, RequestUploadInput } from "@/lib/validators/event"
import { MAX_ATTACHMENTS_PER_EVENT } from "@/lib/validators/event"
import { withOrg } from "@/server/db"
import { assertOrgWritable, assertStorageQuota } from "@/server/quota"
import { objectKeyForAttachment, presignDownload, presignUpload } from "@/server/storage"

// FR-17 (docs/02-prd.md §D): berkas tidak pernah melewati server aplikasi.
// Alurnya: minta URL presigned → unggah langsung dari peramban → konfirmasi
// (menulis baris attachments + menambah used_storage_bytes) di satu transaksi.

export class AttachmentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AttachmentError"
  }
}

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
}

export async function requestAttachmentUpload(
  organizationId: string,
  input: RequestUploadInput,
): Promise<{ uploadUrl: string; objectKey: string }> {
  return withOrg(organizationId, async (tx) => {
    await assertOrgWritable(organizationId, tx)
    const event = await tx.assetEvent.findFirst({
      where: { id: input.eventId, organizationId },
      select: { id: true, assetId: true },
    })
    if (!event) throw new AttachmentError("Entri riwayat tidak ditemukan.")

    const existing = await tx.attachment.count({ where: { eventId: event.id } })
    if (existing >= MAX_ATTACHMENTS_PER_EVENT) {
      throw new AttachmentError(`Maksimal ${MAX_ATTACHMENTS_PER_EVENT} lampiran per entri riwayat.`)
    }

    await assertStorageQuota(organizationId, BigInt(input.sizeBytes), tx)

    const objectKey = objectKeyForAttachment({
      organizationId,
      assetId: event.assetId,
      eventId: event.id,
      ext: EXT_BY_MIME[input.contentType] ?? "bin",
    })
    const { url } = await presignUpload({ objectKey, contentType: input.contentType })
    return { uploadUrl: url, objectKey }
  })
}

export async function confirmAttachment(
  organizationId: string,
  actorUserId: string,
  input: ConfirmAttachmentInput,
): Promise<{ attachmentId: string }> {
  return withOrg(organizationId, async (tx) => {
    await assertOrgWritable(organizationId, tx)
    const event = await tx.assetEvent.findFirst({
      where: { id: input.eventId, organizationId },
      select: { id: true },
    })
    if (!event) throw new AttachmentError("Entri riwayat tidak ditemukan.")

    const existing = await tx.attachment.count({ where: { eventId: event.id } })
    if (existing >= MAX_ATTACHMENTS_PER_EVENT) {
      throw new AttachmentError(`Maksimal ${MAX_ATTACHMENTS_PER_EVENT} lampiran per entri riwayat.`)
    }

    await assertStorageQuota(organizationId, BigInt(input.sizeBytes), tx)

    const attachment = await tx.attachment.create({
      data: {
        organizationId,
        eventId: event.id,
        objectKey: input.objectKey,
        mimeType: input.mimeType,
        sizeBytes: BigInt(input.sizeBytes),
        width: input.width ?? null,
        height: input.height ?? null,
        originalFilename: input.originalFilename ?? null,
        uploadedBy: actorUserId,
      },
      select: { id: true },
    })

    await tx.organization.update({
      where: { id: organizationId },
      data: { usedStorageBytes: { increment: BigInt(input.sizeBytes) } },
    })

    return { attachmentId: attachment.id }
  })
}

/** Lampiran hanya dapat dilihat setelah login, lewat URL bertanda tangan berumur pendek. */
export async function getAttachmentDownloadUrl(
  organizationId: string,
  attachmentId: string,
): Promise<{ url: string }> {
  return withOrg(organizationId, async (tx) => {
    const attachment = await tx.attachment.findFirst({
      where: { id: attachmentId, organizationId },
      select: { objectKey: true },
    })
    if (!attachment) throw new AttachmentError("Lampiran tidak ditemukan.")
    return presignDownload({ objectKey: attachment.objectKey })
  })
}

export type EventAttachment = {
  id: string
  mimeType: string
  sizeBytes: bigint
  originalFilename: string | null
}

export async function listEventAttachments(
  organizationId: string,
  eventId: string,
): Promise<EventAttachment[]> {
  return withOrg(organizationId, (tx) =>
    tx.attachment.findMany({
      where: { eventId, organizationId },
      orderBy: { createdAt: "asc" },
      select: { id: true, mimeType: true, sizeBytes: true, originalFilename: true },
    }),
  )
}

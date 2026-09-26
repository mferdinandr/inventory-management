"use server"

import { hasPermission } from "@/lib/permissions"
import { confirmAttachmentSchema, requestUploadSchema } from "@/lib/validators/event"
import { QuotaExceededError } from "@/server/quota"
import {
  AttachmentError,
  confirmAttachment,
  getAttachmentDownloadUrl,
  requestAttachmentUpload,
} from "@/server/services/attachment.service"
import { requireActiveOrg, requireUser } from "@/server/tenant"

type RequestResult =
  | { ok: true; uploadUrl: string; objectKey: string }
  | { ok: false; error: string }

export async function requestAttachmentUploadAction(input: {
  eventId: string
  contentType: string
  sizeBytes: number
  originalFilename?: string
}): Promise<RequestResult> {
  const user = await requireUser()
  if (!hasPermission(user.role, "event:create")) {
    return { ok: false, error: "Anda tidak memiliki izin mengunggah lampiran." }
  }
  const organizationId = await requireActiveOrg()

  const parsed = requestUploadSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }

  try {
    const result = await requestAttachmentUpload(organizationId, parsed.data)
    return { ok: true, ...result }
  } catch (e) {
    if (e instanceof AttachmentError || e instanceof QuotaExceededError) {
      return { ok: false, error: e.message }
    }
    return { ok: false, error: "Terjadi galat tak terduga." }
  }
}

type ConfirmResult = { ok: true; attachmentId: string } | { ok: false; error: string }

export async function confirmAttachmentAction(input: {
  eventId: string
  objectKey: string
  mimeType: string
  sizeBytes: number
  width?: number
  height?: number
  originalFilename?: string
}): Promise<ConfirmResult> {
  const user = await requireUser()
  if (!hasPermission(user.role, "event:create")) {
    return { ok: false, error: "Anda tidak memiliki izin mengunggah lampiran." }
  }
  const organizationId = await requireActiveOrg()

  const parsed = confirmAttachmentSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }

  try {
    const result = await confirmAttachment(organizationId, user.id, parsed.data)
    return { ok: true, ...result }
  } catch (e) {
    if (e instanceof AttachmentError || e instanceof QuotaExceededError) {
      return { ok: false, error: e.message }
    }
    return { ok: false, error: "Terjadi galat tak terduga." }
  }
}

export async function getAttachmentUrlAction(
  attachmentId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireUser()
  const organizationId = await requireActiveOrg()
  try {
    const { url } = await getAttachmentDownloadUrl(organizationId, attachmentId)
    return { ok: true, url }
  } catch (e) {
    if (e instanceof AttachmentError) return { ok: false, error: e.message }
    return { ok: false, error: "Terjadi galat tak terduga." }
  }
}

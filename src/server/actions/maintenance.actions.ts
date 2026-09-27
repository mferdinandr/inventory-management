"use server"

import { revalidatePath } from "next/cache"
import { hasPermission } from "@/lib/permissions"
import {
  recordExecutionSchema,
  requestCertificateUploadSchema,
  scheduleFormSchema,
  scheduleIdSchema,
} from "@/lib/validators/maintenance"
import { QuotaExceededError } from "@/server/quota"
import {
  createSchedule,
  getCertificateDownloadUrl,
  MaintenanceError,
  recordMaintenanceExecution,
  requestCertificateUpload,
  setScheduleActive,
} from "@/server/services/maintenance.service"
import { requireActiveOrg, requireUser } from "@/server/tenant"

type ActionState = { ok: true } | { ok: false; error: string }

function err(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

function raw(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "")
}

function assertCanMaintain(
  role: Parameters<typeof hasPermission>[0],
): { ok: false; error: string } | null {
  if (!hasPermission(role, "event:maintenance")) {
    return err("Anda tidak memiliki izin mengelola pemeliharaan.")
  }
  return null
}

export async function createScheduleAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()
  const denied = assertCanMaintain(user.role)
  if (denied) return denied
  const organizationId = await requireActiveOrg()

  const parsed = scheduleFormSchema.safeParse({
    assetId: raw(formData, "assetId"),
    type: raw(formData, "type"),
    intervalMonths: raw(formData, "intervalMonths"),
    nextDueAt: raw(formData, "nextDueAt"),
    notes: raw(formData, "notes"),
  })
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Data tidak valid.")

  try {
    await createSchedule(organizationId, parsed.data)
    revalidatePath(`/assets/${parsed.data.assetId}`)
    revalidatePath("/maintenance")
    return { ok: true }
  } catch (e) {
    if (e instanceof MaintenanceError) return err(e.message)
    return err("Terjadi galat tak terduga.")
  }
}

export async function setScheduleActiveAction(
  scheduleId: string,
  isActive: boolean,
  assetId: string,
): Promise<ActionState> {
  const user = await requireUser()
  const denied = assertCanMaintain(user.role)
  if (denied) return denied
  const organizationId = await requireActiveOrg()
  const parsed = scheduleIdSchema.safeParse({ id: scheduleId })
  if (!parsed.success) return err("Jadwal tidak ditemukan.")

  try {
    await setScheduleActive(organizationId, parsed.data.id, isActive)
    revalidatePath(`/assets/${assetId}`)
    revalidatePath("/maintenance")
    return { ok: true }
  } catch (e) {
    if (e instanceof MaintenanceError) return err(e.message)
    return err("Terjadi galat tak terduga.")
  }
}

type RecordActionState = { ok: true; result: string } | { ok: false; error: string }

export async function recordExecutionAction(
  _prev: RecordActionState | null,
  formData: FormData,
): Promise<RecordActionState> {
  const user = await requireUser()
  const denied = assertCanMaintain(user.role)
  if (denied) return denied
  const organizationId = await requireActiveOrg()

  const parsed = recordExecutionSchema.safeParse({
    scheduleId: raw(formData, "scheduleId"),
    performedAt: raw(formData, "performedAt"),
    performedBy: raw(formData, "performedBy"),
    performedByVendorId: raw(formData, "performedByVendorId"),
    performedByInternal: raw(formData, "performedByInternal"),
    result: raw(formData, "result"),
    validUntil: raw(formData, "validUntil"),
    certificateNumber: raw(formData, "certificateNumber"),
    certificateObjectKey: raw(formData, "certificateObjectKey"),
    cost: raw(formData, "cost"),
    partsReplaced: raw(formData, "partsReplaced"),
    description: raw(formData, "description"),
  })
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Data tidak valid.")

  const assetId = raw(formData, "assetId")

  try {
    await recordMaintenanceExecution(organizationId, user.id, parsed.data)
    if (assetId) revalidatePath(`/assets/${assetId}`)
    revalidatePath("/maintenance")
    return { ok: true, result: parsed.data.result }
  } catch (e) {
    if (e instanceof MaintenanceError) return err(e.message)
    return err("Terjadi galat tak terduga.")
  }
}

type UploadResult =
  | { ok: true; uploadUrl: string; objectKey: string }
  | { ok: false; error: string }

export async function requestCertificateUploadAction(input: {
  assetId: string
  scheduleId: string
  contentType: string
  sizeBytes: number
}): Promise<UploadResult> {
  const user = await requireUser()
  const denied = assertCanMaintain(user.role)
  if (denied) return { ok: false, error: denied.error }
  const organizationId = await requireActiveOrg()

  const parsed = requestCertificateUploadSchema.safeParse(input)
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." }

  try {
    const result = await requestCertificateUpload(organizationId, parsed.data)
    return { ok: true, ...result }
  } catch (e) {
    if (e instanceof MaintenanceError || e instanceof QuotaExceededError) {
      return { ok: false, error: e.message }
    }
    return { ok: false, error: "Terjadi galat tak terduga." }
  }
}

export async function getCertificateUrlAction(
  recordId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireUser()
  const organizationId = await requireActiveOrg()
  try {
    const { url } = await getCertificateDownloadUrl(organizationId, recordId)
    return { ok: true, url }
  } catch (e) {
    if (e instanceof MaintenanceError) return { ok: false, error: e.message }
    return { ok: false, error: "Terjadi galat tak terduga." }
  }
}

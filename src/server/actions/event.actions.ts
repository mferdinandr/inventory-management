"use server"

import { revalidatePath } from "next/cache"
import { hasPermission } from "@/lib/permissions"
import { InvalidStatusTransitionError } from "@/lib/status-machine"
import {
  correctEventSchema,
  disposeAssetSchema,
  historyEventSchema,
  transferAssetSchema,
} from "@/lib/validators/event"
import {
  correctEvent,
  disposeAsset,
  EventError,
  recordHistoryEvent,
  revertDisposal,
  transferAsset,
} from "@/server/services/event.service"
import { requireActiveOrg, requireUser } from "@/server/tenant"

type ActionState = { ok: true; eventId: string } | { ok: false; error: string }

function err(message: string): ActionState {
  return { ok: false, error: message }
}

function raw(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "")
}

export async function recordHistoryEventAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()
  if (!hasPermission(user.role, "event:create")) {
    return err("Anda tidak memiliki izin mencatat riwayat.")
  }
  const organizationId = await requireActiveOrg()

  const parsed = historyEventSchema.safeParse({
    assetId: raw(formData, "assetId"),
    type: raw(formData, "type"),
    title: raw(formData, "title"),
    notes: raw(formData, "notes"),
    occurredAt: raw(formData, "occurredAt"),
    newStatus: raw(formData, "newStatus") || undefined,
  })
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Data tidak valid.")

  try {
    const { eventId } = await recordHistoryEvent(organizationId, user.id, parsed.data)
    revalidatePath(`/assets/${parsed.data.assetId}`)
    return { ok: true, eventId }
  } catch (e) {
    if (e instanceof EventError || e instanceof InvalidStatusTransitionError) return err(e.message)
    return err("Terjadi galat tak terduga.")
  }
}

export async function transferAssetAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()
  if (!hasPermission(user.role, "asset:transfer")) {
    return err("Anda tidak memiliki izin memutasi aset.")
  }
  const organizationId = await requireActiveOrg()

  const parsed = transferAssetSchema.safeParse({
    assetId: raw(formData, "assetId"),
    toLocationId: raw(formData, "toLocationId"),
    reason: raw(formData, "reason"),
    occurredAt: raw(formData, "occurredAt"),
  })
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Data tidak valid.")

  try {
    const { eventId } = await transferAsset(organizationId, user.id, parsed.data)
    revalidatePath(`/assets/${parsed.data.assetId}`)
    return { ok: true, eventId }
  } catch (e) {
    if (e instanceof EventError) return err(e.message)
    return err("Terjadi galat tak terduga.")
  }
}

export async function disposeAssetAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()
  if (!hasPermission(user.role, "asset:dispose")) {
    return err("Anda tidak memiliki izin menghapuskan aset.")
  }
  const organizationId = await requireActiveOrg()

  const parsed = disposeAssetSchema.safeParse({
    assetId: raw(formData, "assetId"),
    reason: raw(formData, "reason"),
    occurredAt: raw(formData, "occurredAt"),
  })
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Data tidak valid.")

  try {
    const { eventId } = await disposeAsset(organizationId, user.id, parsed.data)
    revalidatePath(`/assets/${parsed.data.assetId}`)
    revalidatePath("/assets/disposed")
    return { ok: true, eventId }
  } catch (e) {
    if (e instanceof EventError) return err(e.message)
    return err("Terjadi galat tak terduga.")
  }
}

export async function revertDisposalAction(
  assetId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser()
  if (!hasPermission(user.role, "asset:revertDisposal")) {
    return { ok: false, error: "Anda tidak memiliki izin membatalkan penghapusan." }
  }
  const organizationId = await requireActiveOrg()

  try {
    await revertDisposal(organizationId, user.id, assetId)
    revalidatePath(`/assets/${assetId}`)
    revalidatePath("/assets/disposed")
    return { ok: true }
  } catch (e) {
    if (e instanceof EventError) return { ok: false, error: e.message }
    return { ok: false, error: "Terjadi galat tak terduga." }
  }
}

export async function correctEventAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()
  if (!hasPermission(user.role, "event:correct")) {
    return err("Anda tidak memiliki izin mengoreksi riwayat.")
  }
  const organizationId = await requireActiveOrg()

  const parsed = correctEventSchema.safeParse({
    eventId: raw(formData, "eventId"),
    reason: raw(formData, "reason"),
  })
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Data tidak valid.")

  try {
    const { eventId } = await correctEvent(
      organizationId,
      user.id,
      parsed.data.eventId,
      parsed.data.reason,
    )
    const assetId = raw(formData, "assetId")
    if (assetId) revalidatePath(`/assets/${assetId}`)
    return { ok: true, eventId }
  } catch (e) {
    if (e instanceof EventError) return err(e.message)
    return err("Terjadi galat tak terduga.")
  }
}

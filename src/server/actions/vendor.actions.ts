"use server"

import { hasPermission } from "@/lib/permissions"
import type { VendorFormInput } from "@/lib/validators/vendor"
import { vendorFormSchema, vendorIdSchema } from "@/lib/validators/vendor"
import {
  createVendor,
  setVendorActive,
  updateVendor,
  VendorError,
} from "@/server/services/vendor.service"
import { requireActiveOrg, requireUser } from "@/server/tenant"
import type { UserRole } from "../../../generated/prisma/enums"

type ActionState = { ok: true; message: string } | { ok: false; error: string }

function err(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

function assertCanManage(role: UserRole): ActionState | null {
  if (!hasPermission(role, "master:manage")) {
    return err("Anda tidak memiliki izin untuk tindakan ini.")
  }
  return null
}

function parseVendorInput(
  formData: FormData,
): { ok: true; data: VendorFormInput } | { ok: false; error: string } {
  const raw = {
    name: formData.get("name") ?? "",
    type: formData.getAll("type"),
    contactPerson: formData.get("contactPerson") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    address: formData.get("address") ?? "",
  }
  const parsed = vendorFormSchema.safeParse(raw)
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Data tidak valid.")
  return { ok: true, data: parsed.data }
}

async function toActionState(fn: () => Promise<unknown>): Promise<ActionState> {
  try {
    await fn()
    return { ok: true, message: "Perubahan tersimpan." }
  } catch (e) {
    if (e instanceof VendorError) return err(e.message)
    return err("Terjadi galat tak terduga.")
  }
}

export async function createVendorAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()
  const denied = assertCanManage(user.role)
  if (denied) return denied
  const organizationId = await requireActiveOrg()
  const input = parseVendorInput(formData)
  if (!input.ok) return input
  return toActionState(() => createVendor(organizationId, user.id, input.data))
}

export async function updateVendorAction(
  vendorId: string,
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()
  const denied = assertCanManage(user.role)
  if (denied) return denied
  const organizationId = await requireActiveOrg()
  const idParsed = vendorIdSchema.safeParse({ id: vendorId })
  if (!idParsed.success) return err("Vendor tidak ditemukan.")
  const input = parseVendorInput(formData)
  if (!input.ok) return input
  return toActionState(() => updateVendor(organizationId, user.id, idParsed.data.id, input.data))
}

export async function setVendorActiveAction(
  vendorId: string,
  isActive: boolean,
): Promise<ActionState> {
  const user = await requireUser()
  const denied = assertCanManage(user.role)
  if (denied) return denied
  const organizationId = await requireActiveOrg()
  const parsed = vendorIdSchema.safeParse({ id: vendorId })
  if (!parsed.success) return err("Vendor tidak ditemukan.")
  return toActionState(() => setVendorActive(organizationId, user.id, parsed.data.id, isActive))
}

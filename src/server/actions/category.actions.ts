"use server"

import { hasPermission } from "@/lib/permissions"
import {
  categoryFormSchema,
  categoryIdSchema,
  setCategoryActiveSchema,
} from "@/lib/validators/category"
import {
  CategoryError,
  type CategoryInput,
  createCategory,
  setCategoryActive,
  updateCategory,
} from "@/server/services/category.service"
import { requireActiveOrg, requireUser } from "@/server/tenant"
import type { UserRole } from "../../../generated/prisma/enums"

type ActionState = { ok: true; message: string } | { ok: false; error: string }

function err(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

function parseCategoryInput(
  input: FormData,
): { ok: true; data: CategoryInput } | { ok: false; error: string } {
  const raw = {
    name: input.get("name") ?? "",
    code: input.get("code") ?? "",
    parentId: input.get("parentId") || null,
    isMedicalDevice: input.get("isMedicalDevice") === "on",
    defaultCalibrationIntervalMonths: input.get("defaultCalibrationIntervalMonths") || null,
  }
  const parsed = categoryFormSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }
  return { ok: true, data: parsed.data }
}

function parseId(categoryId: string): { ok: true; id: string } | { ok: false; error: string } {
  const parsed = categoryIdSchema.safeParse({ id: categoryId })
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Data tidak valid.")
  return { ok: true, id: parsed.data.id }
}

async function toActionState(fn: () => Promise<unknown>): Promise<ActionState> {
  try {
    await fn()
    return { ok: true, message: "Perubahan tersimpan." }
  } catch (e: unknown) {
    if (e instanceof CategoryError) return err(e.message)
    if (e instanceof Error) return err(e.message)
    return err("Terjadi galat tak terduga.")
  }
}

function assertCanManage(role: UserRole): ActionState | null {
  if (!hasPermission(role, "master:manage"))
    return err("Anda tidak memiliki izin untuk tindakan ini.")
  return null
}

export async function createCategoryAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()
  const denied = assertCanManage(user.role)
  if (denied) return denied
  const organizationId = await requireActiveOrg()
  const input = parseCategoryInput(formData)
  if (!input.ok) return input
  return toActionState(() => createCategory(organizationId, user.id, input.data))
}

export async function updateCategoryAction(
  categoryId: string,
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()
  const denied = assertCanManage(user.role)
  if (denied) return denied
  const organizationId = await requireActiveOrg()
  const idParsed = parseId(categoryId)
  if (!idParsed.ok) return idParsed
  const input = parseCategoryInput(formData)
  if (!input.ok) return input
  return toActionState(() => updateCategory(organizationId, user.id, idParsed.id, input.data))
}

export async function setCategoryActiveAction(
  categoryId: string,
  isActive: boolean,
): Promise<ActionState> {
  const user = await requireUser()
  const denied = assertCanManage(user.role)
  if (denied) return denied
  const organizationId = await requireActiveOrg()
  const parsed = setCategoryActiveSchema.safeParse({ id: categoryId, isActive })
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Data tidak valid.")
  return toActionState(() =>
    setCategoryActive(organizationId, user.id, parsed.data.id, parsed.data.isActive),
  )
}

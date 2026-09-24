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

type ActionState = { ok: true; message: string } | { ok: false; error: string }

function parseCategoryInput(input: FormData): CategoryInput {
  const raw = {
    name: input.get("name") ?? "",
    code: input.get("code") ?? "",
    parentId: input.get("parentId") || null,
    isMedicalDevice: input.get("isMedicalDevice") === "on",
    defaultCalibrationIntervalMonths: input.get("defaultCalibrationIntervalMonths") || null,
  }
  return categoryFormSchema.parse(raw)
}

async function toActionState(fn: () => Promise<unknown>): Promise<ActionState> {
  try {
    await fn()
    return { ok: true, message: "Perubahan tersimpan." }
  } catch (e: unknown) {
    if (e instanceof CategoryError) return { ok: false, error: e.message }
    if (e instanceof Error) return { ok: false, error: e.message }
    return { ok: false, error: "Terjadi galat tak terduga." }
  }
}

export async function createCategoryAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()
  if (!hasPermission(user.role, "master:manage"))
    return { ok: false, error: "Anda tidak memiliki izin untuk tindakan ini." }
  const organizationId = await requireActiveOrg()
  const input = parseCategoryInput(formData)
  return toActionState(() => createCategory(organizationId, user.id, input))
}

export async function updateCategoryAction(
  categoryId: string,
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()
  if (!hasPermission(user.role, "master:manage"))
    return { ok: false, error: "Anda tidak memiliki izin untuk tindakan ini." }
  const organizationId = await requireActiveOrg()
  categoryIdSchema.parse({ id: categoryId })
  const input = parseCategoryInput(formData)
  return toActionState(() => updateCategory(organizationId, user.id, categoryId, input))
}

export async function setCategoryActiveAction(
  categoryId: string,
  isActive: boolean,
): Promise<ActionState> {
  const user = await requireUser()
  if (!hasPermission(user.role, "master:manage"))
    return { ok: false, error: "Anda tidak memiliki izin untuk tindakan ini." }
  const organizationId = await requireActiveOrg()
  setCategoryActiveSchema.parse({ id: categoryId, isActive })
  return toActionState(() => setCategoryActive(organizationId, user.id, categoryId, isActive))
}

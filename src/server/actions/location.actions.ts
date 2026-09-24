"use server"

import { requirePermission } from "@/lib/permissions"
import { createLocationSchema, updateLocationSchema } from "@/lib/validators/location"
import type { ActionResult } from "@/server/services/location.service"
import { createLocation, updateLocation } from "@/server/services/location.service"
import { requireActiveOrg, requireUser } from "@/server/tenant"

export async function createLocationAction(
  data: unknown,
): Promise<ActionResult<{ id: string; path: string }>> {
  try {
    const user = await requireUser()
    const organizationId = await requireActiveOrg()
    requirePermission(user.role, "master:manage")

    const parsed = createLocationSchema.safeParse(data)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
    }
    return await createLocation({ organizationId, actorId: user.id, data: parsed.data })
  } catch (error) {
    return errorResult(error)
  }
}

export async function updateLocationAction(
  id: string,
  data: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser()
    const organizationId = await requireActiveOrg()
    requirePermission(user.role, "master:manage")

    const parsed = updateLocationSchema.safeParse(data)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
    }
    return await updateLocation({ organizationId, actorId: user.id, id, data: parsed.data })
  } catch (error) {
    return errorResult(error)
  }
}

function errorResult(error: unknown): { ok: false; error: string } {
  if (error instanceof Error && error.message) return { ok: false, error: error.message }
  return { ok: false, error: "Terjadi kesalahan tak terduga. Silakan coba lagi." }
}

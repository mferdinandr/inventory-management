"use server"

import { hasPermission } from "@/lib/permissions"
import type { AssetFormInput } from "@/lib/validators/asset"
import type { ImportRowError } from "@/lib/validators/import"
import { QuotaExceededError } from "@/server/quota"
import { AssetError, DuplicateSerialError } from "@/server/services/asset.service"
import {
  commitImportBatch,
  parseImportFile,
  validateImportRows,
} from "@/server/services/import.service"
import { requireActiveOrg, requireUser } from "@/server/tenant"

type PreviewState =
  | { ok: true; validCount: number; errors: ImportRowError[]; rows: AssetFormInput[] }
  | { ok: false; error: string }

export async function previewImportAction(formData: FormData): Promise<PreviewState> {
  const user = await requireUser()
  if (!hasPermission(user.role, "asset:import")) {
    return { ok: false, error: "Anda tidak memiliki izin mengimpor aset." }
  }
  const organizationId = await requireActiveOrg()

  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Pilih berkas Excel atau CSV terlebih dahulu." }
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const rawRows = await parseImportFile(buffer, file.type)
    if (rawRows.length === 0) {
      return { ok: false, error: "Berkas kosong atau tidak sesuai templat." }
    }
    const { validRows, errors } = await validateImportRows(organizationId, rawRows)
    return {
      ok: true,
      validCount: validRows.length,
      errors,
      rows: validRows.map((r) => r.input),
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal membaca berkas." }
  }
}

type CommitState = { ok: true; assetIds: string[] } | { ok: false; error: string }

export async function commitImportAction(rows: AssetFormInput[]): Promise<CommitState> {
  const user = await requireUser()
  if (!hasPermission(user.role, "asset:import")) {
    return { ok: false, error: "Anda tidak memiliki izin mengimpor aset." }
  }
  const organizationId = await requireActiveOrg()

  try {
    const results = await commitImportBatch(organizationId, user.id, rows)
    return { ok: true, assetIds: results.map((r) => r.id) }
  } catch (e) {
    if (
      e instanceof AssetError ||
      e instanceof DuplicateSerialError ||
      e instanceof QuotaExceededError
    ) {
      return { ok: false, error: e.message }
    }
    return { ok: false, error: "Terjadi galat tak terduga saat menyimpan." }
  }
}

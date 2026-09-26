"use server"

import { hasPermission } from "@/lib/permissions"
import { assetFormSchema, assetIdSchema, printReasonSchema } from "@/lib/validators/asset"
import { QuotaExceededError } from "@/server/quota"
import {
  AssetError,
  createAsset,
  DuplicateSerialError,
  recordLabelPrint,
} from "@/server/services/asset.service"
import { requireActiveOrg, requireUser } from "@/server/tenant"

type ActionState =
  | { ok: true; assetId: string; assetCode: string }
  | { ok: false; error: string; duplicateSerial?: true }

function err(message: string, duplicateSerial?: true): ActionState {
  return duplicateSerial
    ? { ok: false, error: message, duplicateSerial }
    : { ok: false, error: message }
}

export async function createAssetAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()
  if (!hasPermission(user.role, "asset:create")) {
    return err("Anda tidak memiliki izin untuk mendaftarkan aset.")
  }
  const organizationId = await requireActiveOrg()

  const raw = {
    name: formData.get("name") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    locationId: formData.get("locationId") ?? "",
    condition: formData.get("condition") ?? "GOOD",
    acquisitionDate: formData.get("acquisitionDate") ?? "",
    brand: formData.get("brand") ?? "",
    model: formData.get("model") ?? "",
    serialNumber: formData.get("serialNumber") ?? "",
    yearManufactured: formData.get("yearManufactured") ?? "",
    fundingSource: formData.get("fundingSource") ?? "",
    acquisitionCost: formData.get("acquisitionCost") ?? "",
    acquisitionDocumentNo: formData.get("acquisitionDocumentNo") ?? "",
    warrantyUntil: formData.get("warrantyUntil") ?? "",
    economicLifeYears: formData.get("economicLifeYears") ?? "",
    notes: formData.get("notes") ?? "",
    confirmDuplicateSerial: formData.get("confirmDuplicateSerial") === "on",
  }

  const parsed = assetFormSchema.safeParse(raw)
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Data tidak valid.")
  }

  try {
    const asset = await createAsset(organizationId, user.id, parsed.data)
    return { ok: true, assetId: asset.id, assetCode: asset.assetCode }
  } catch (e) {
    if (e instanceof DuplicateSerialError) return err(e.message, true)
    if (e instanceof AssetError) return err(e.message)
    if (e instanceof QuotaExceededError) return err(e.message)
    if (e instanceof Error) return err(e.message)
    return err("Terjadi galat tak terduga.")
  }
}

type PrintActionState = { ok: true } | { ok: false; error: string }

export async function recordLabelPrintAction(
  assetId: string,
  reason: string,
  labelSize: string,
): Promise<PrintActionState> {
  const user = await requireUser()
  if (!hasPermission(user.role, "label:print")) {
    return { ok: false, error: "Anda tidak memiliki izin mencetak label." }
  }
  const organizationId = await requireActiveOrg()
  const parsed = printReasonSchema.safeParse({ assetId, reason, labelSize })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }
  const idCheck = assetIdSchema.safeParse({ id: assetId })
  if (!idCheck.success) return { ok: false, error: "Aset tidak ditemukan." }

  try {
    await recordLabelPrint(
      organizationId,
      user.id,
      parsed.data.assetId,
      parsed.data.reason,
      parsed.data.labelSize,
    )
    return { ok: true }
  } catch (e) {
    if (e instanceof AssetError) return { ok: false, error: e.message }
    return { ok: false, error: "Terjadi galat tak terduga." }
  }
}

/** Lembar A4 (FR-13): satu tindakan cetak mencatat entri per aset di lembar itu. */
export async function recordSheetPrintAction(assetIds: string[]): Promise<PrintActionState> {
  const user = await requireUser()
  if (!hasPermission(user.role, "label:print")) {
    return { ok: false, error: "Anda tidak memiliki izin mencetak label." }
  }
  const organizationId = await requireActiveOrg()

  try {
    for (const assetId of assetIds) {
      const idCheck = assetIdSchema.safeParse({ id: assetId })
      if (!idCheck.success) continue
      await recordLabelPrint(organizationId, user.id, idCheck.data.id, "FIRST_PRINT", "A4_SHEET")
    }
    return { ok: true }
  } catch (e) {
    if (e instanceof AssetError) return { ok: false, error: e.message }
    return { ok: false, error: "Terjadi galat tak terduga." }
  }
}

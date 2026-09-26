"use server"

import { findAssetIdByCode, findAssetIdByPublicId } from "@/server/services/asset.service"
import { requireActiveOrg, requireUser } from "@/server/tenant"

type ScanResult = { ok: true; assetId: string } | { ok: false; error: string }

/**
 * FR-25: satu pintu masuk untuk hasil pemindaian kamera (QR berisi URL
 * lengkap, lihat docs/08) maupun isian kode aset manual — keduanya
 * diselesaikan lewat sesi pengguna, jadi aset organisasi lain tidak pernah
 * ditemukan (bukan disembunyikan; RLS membuatnya benar-benar tak terlihat).
 */
export async function resolveScanAction(rawValue: string): Promise<ScanResult> {
  await requireUser()
  const organizationId = await requireActiveOrg()
  const value = rawValue.trim()
  if (!value) return { ok: false, error: "Tidak ada nilai untuk dicari." }

  // QR berisi URL absolut https://{domain}/a/{publicId} — ambil segmen
  // terakhirnya kalau memang begitu bentuknya, dukung juga public_id polos.
  const match = value.match(/\/a\/([A-Za-z0-9]+)\/?$/)
  const publicId = match ? match[1]! : value

  const byPublicId = await findAssetIdByPublicId(organizationId, publicId)
  if (byPublicId) return { ok: true, assetId: byPublicId }

  const byCode = await findAssetIdByCode(organizationId, value)
  if (byCode) return { ok: true, assetId: byCode }

  return { ok: false, error: "Aset tidak ditemukan di organisasi Anda." }
}

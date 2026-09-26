// docs/08-qr-labeling.md §"Format public_id" / §"Format asset_code".

// 57 karakter, tanpa 0/O/1/l/I yang mudah tertukar saat dibaca manusia.
const PUBLIC_ID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
const PUBLIC_ID_LENGTH = 12

/**
 * QR memuat URL berisi ini, bukan data aset — lihat ADR di docs/08. Diminta
 * ulang oleh pemanggil (asset.service.ts) bila terjadi tabrakan unik; secara
 * teoretis nyaris mustahil pada skala ribuan aset (57^12 kombinasi).
 */
export function generatePublicId(): string {
  let out = ""
  for (let i = 0; i < PUBLIC_ID_LENGTH; i++) {
    out += PUBLIC_ID_ALPHABET[Math.floor(Math.random() * PUBLIC_ID_ALPHABET.length)]
  }
  return out
}

/**
 * `{KODE_RS}-{KODE_INSTALASI}-{TAHUN}-{URUTAN}`, mis. `RSXX-RAD-2026-0012`.
 * Urutan dihitung per instalasi per tahun (docs/08) — pemanggil menyuplai
 * `sequence` hasil hitungan itu, fungsi ini hanya memformat.
 */
export function formatAssetCode(params: {
  orgCode: string
  departmentCode: string
  year: number
  sequence: number
}): string {
  const seq = String(params.sequence).padStart(4, "0")
  return `${params.orgCode}-${params.departmentCode}-${params.year}-${seq}`
}

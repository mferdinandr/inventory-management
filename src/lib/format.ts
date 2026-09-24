const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const

/** 21474836480 → "20 GB". Satuan biner (1 GB = 1024³ byte), sama dengan kuota. */
export function formatBytes(bytes: bigint | number): string {
  let value = Number(bytes)
  let unit = 0
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024
    unit++
  }
  const digits = unit === 0 || value >= 10 ? 0 : 1
  return `${value.toLocaleString("id-ID", { maximumFractionDigits: digits })} ${BYTE_UNITS[unit]}`
}

import type { AssetStatus } from "../../generated/prisma/enums"

/**
 * docs/03-erd.md §4: transisi yang tidak terdaftar di sini ditolak. `ON_LOAN`
 * sengaja tidak dapat dimasuki/ditinggalkan lewat daftar ini — itu hanya
 * boleh terjadi lewat loan.service (checkout/return), bukan pengubahan status
 * manual (FR-09).
 */
const MANUAL_TRANSITIONS: Record<AssetStatus, readonly AssetStatus[]> = {
  AVAILABLE: ["IN_USE", "DAMAGED", "UNDER_REPAIR", "AT_VENDOR", "LOST", "DISPOSED"],
  IN_USE: ["AVAILABLE", "DAMAGED", "AT_VENDOR", "LOST"],
  ON_LOAN: [],
  UNDER_REPAIR: ["AVAILABLE", "AT_VENDOR", "DAMAGED"],
  AT_VENDOR: ["AVAILABLE", "DAMAGED"],
  DAMAGED: ["UNDER_REPAIR", "AT_VENDOR", "DISPOSED"],
  LOST: ["AVAILABLE", "DISPOSED"],
  DISPOSED: [],
}

/** Ke status apa `DISPOSED` boleh dibatalkan (FR-11): ke nilai sebelum dihapuskan. */
const DISPOSAL_REVERT_TARGETS: readonly AssetStatus[] = ["AVAILABLE", "DAMAGED", "LOST"]

export class InvalidStatusTransitionError extends Error {
  constructor(from: AssetStatus, to: AssetStatus) {
    super(`Status tidak dapat diubah dari ${from} ke ${to}.`)
    this.name = "InvalidStatusTransitionError"
  }
}

export function canTransitionManually(from: AssetStatus, to: AssetStatus): boolean {
  return MANUAL_TRANSITIONS[from].includes(to)
}

export function assertManualTransition(from: AssetStatus, to: AssetStatus): void {
  if (!canTransitionManually(from, to)) throw new InvalidStatusTransitionError(from, to)
}

export function canRevertDisposal(statusBeforeDisposal: AssetStatus | null): boolean {
  return statusBeforeDisposal !== null && DISPOSAL_REVERT_TARGETS.includes(statusBeforeDisposal)
}

/** Status boleh dimutasi/dipinjam hanya dari sini (FR-10/FR-18). */
export function isTransferable(status: AssetStatus): boolean {
  return status !== "ON_LOAN" && status !== "DISPOSED"
}

export function isLoanable(status: AssetStatus): boolean {
  return status === "AVAILABLE" || status === "IN_USE"
}

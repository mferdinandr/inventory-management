import type { UserRole } from "../../generated/prisma/enums"

export type Permission =
  | "asset:view"
  | "asset:viewSensitive"
  | "asset:create"
  | "asset:update"
  | "asset:transfer"
  | "asset:changeStatus"
  | "asset:dispose"
  | "asset:revertDisposal"
  | "asset:import"
  | "event:view"
  | "event:create"
  | "event:maintenance"
  | "event:correct"
  | "loan:manage"
  | "loan:viewContact"
  | "label:print"
  | "master:manage"
  | "user:manage"
  | "org:configure"
  | "report:view"
  | "audit:view"

export const PERMISSIONS: Record<Exclude<UserRole, "PLATFORM_OWNER">, readonly Permission[]> = {
  SUPERADMIN: [
    "asset:view",
    "asset:viewSensitive",
    "asset:create",
    "asset:update",
    "asset:transfer",
    "asset:changeStatus",
    "asset:dispose",
    "asset:revertDisposal",
    "asset:import",
    "event:view",
    "event:create",
    "event:maintenance",
    "event:correct",
    "loan:manage",
    "loan:viewContact",
    "label:print",
    "master:manage",
    "user:manage",
    "org:configure",
    "report:view",
    "audit:view",
  ],
  ADMIN: [
    "asset:view",
    "asset:viewSensitive",
    "asset:create",
    "asset:update",
    "asset:transfer",
    "asset:changeStatus",
    "asset:dispose",
    "asset:revertDisposal",
    "asset:import",
    "event:view",
    "event:create",
    "event:maintenance",
    "event:correct",
    "loan:manage",
    "loan:viewContact",
    "label:print",
    "master:manage",
    "user:manage",
    "report:view",
    "audit:view",
  ],
  PIC_ROOM: [
    "asset:view",
    "asset:viewSensitive",
    "asset:create",
    "asset:update",
    "asset:transfer",
    "asset:changeStatus",
    "event:view",
    "event:create",
    "event:correct",
    "loan:manage",
    "loan:viewContact",
    "label:print",
    "report:view",
  ],
  TECHNICIAN: [
    "asset:view",
    "asset:changeStatus",
    "event:view",
    "event:maintenance",
    "event:correct",
    "loan:manage",
    "loan:viewContact",
  ],
  VIEWER: [
    "asset:view",
    "asset:viewSensitive",
    "event:view",
    "loan:viewContact",
    "report:view",
  ],
}

export function hasPermission(
  role: UserRole,
  permission: Permission,
): boolean {
  if (role === "PLATFORM_OWNER") return true
  return PERMISSIONS[role].includes(permission)
}

/**
 * Catatan: cakupan `PIC_ROOM` (terbatas lokasi ditugaskan), batasan
 * "koreksi hanya entri yang dicatatnya", dan `asset:changeStatus` milik
 * `TECHNICIAN` (hanya transisi terkait perbaikan) masih diverifikasi di layanan.
 *
 * Matriks ini menjawab "boleh tidak" per peran; cakupan diperiksa di service.
 */

export function requirePermission(role: UserRole, permission: Permission): void {
  if (role === "PLATFORM_OWNER") return
  if (!PERMISSIONS[role].includes(permission)) throw new PermissionDeniedError()
}

export class PermissionDeniedError extends Error {
  constructor() {
    super("Anda tidak memiliki izin untuk tindakan ini.")
    this.name = "PermissionDeniedError"
  }
}
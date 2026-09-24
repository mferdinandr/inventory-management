import { describe, expect, it } from "vitest"
import {
  hasPermission,
  PERMISSIONS,
  type Permission,
  PermissionDeniedError,
  requirePermission,
} from "@/lib/permissions"
import type { UserRole } from "../generated/prisma/enums"

// Reflects the authoritative matrix in docs/07-rbac-security.md §2. Any change here
// must be a deliberate, documented change to that spec — not the other way around.
const EXPECTED: Record<Exclude<UserRole, "PLATFORM_OWNER">, readonly Permission[]> = {
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
  VIEWER: ["asset:view", "asset:viewSensitive", "event:view", "loan:viewContact", "report:view"],
}

describe("PERMISSIONS matrix matches docs/07-rbac-security.md", () => {
  for (const role of Object.keys(EXPECTED) as Array<keyof typeof EXPECTED>) {
    it(`${role} has exactly the permissions the spec lists`, () => {
      expect(new Set(PERMISSIONS[role])).toEqual(new Set(EXPECTED[role]))
    })
  }
})

describe("hasPermission / requirePermission", () => {
  it("PLATFORM_OWNER can do anything, regardless of the matrix", () => {
    expect(hasPermission("PLATFORM_OWNER", "org:configure")).toBe(true)
    expect(() => requirePermission("PLATFORM_OWNER", "asset:dispose")).not.toThrow()
  })

  it("VIEWER cannot create assets", () => {
    expect(hasPermission("VIEWER", "asset:create")).toBe(false)
    expect(() => requirePermission("VIEWER", "asset:create")).toThrow(PermissionDeniedError)
  })

  it("SUPERADMIN can configure the organization", () => {
    expect(hasPermission("SUPERADMIN", "org:configure")).toBe(true)
  })

  it("ADMIN cannot configure the organization, but SUPERADMIN can (asymmetry the spec calls out)", () => {
    expect(hasPermission("ADMIN", "org:configure")).toBe(false)
    expect(hasPermission("SUPERADMIN", "org:configure")).toBe(true)
  })

  it("TECHNICIAN can change asset status (repair transitions) but not view sensitive fields", () => {
    expect(hasPermission("TECHNICIAN", "asset:changeStatus")).toBe(true)
    expect(hasPermission("TECHNICIAN", "asset:viewSensitive")).toBe(false)
  })
})

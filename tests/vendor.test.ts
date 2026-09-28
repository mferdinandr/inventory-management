import { PrismaPg } from "@prisma/adapter-pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { PrismaClient } from "../generated/prisma/client"
import {
  createVendor,
  listActiveVendors,
  listVendors,
  setVendorActive,
  updateVendor,
  VendorError,
} from "../src/server/services/vendor.service"

const setup = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL_PLATFORM ?? process.env.DATABASE_URL ?? "",
  }),
})

let orgId: string
let adminId: string

beforeAll(async () => {
  const org = await setup.organization.findFirstOrThrow({
    where: { code: "RS01" },
    select: { id: true },
  })
  orgId = org.id
  const admin = await setup.user.findFirstOrThrow({
    where: { organizationId: orgId, role: "SUPERADMIN" },
    select: { id: true },
  })
  adminId = admin.id
})

afterAll(async () => {
  await setup.$disconnect()
})

function baseInput(overrides: Partial<Parameters<typeof createVendor>[2]> = {}) {
  return {
    name: `Vendor Uji ${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: ["CALIBRATION" as const],
    contactPerson: "Budi",
    phone: "0812",
    email: "vendor@example.test",
    address: null,
    ...overrides,
  }
}

describe("vendor.service (FR-04)", () => {
  it("creates a vendor and lists it", async () => {
    const { id } = await createVendor(orgId, adminId, baseInput())
    const rows = await listVendors(orgId)
    expect(rows.some((v) => v.id === id)).toBe(true)
  })

  it("updates a vendor's fields", async () => {
    const { id } = await createVendor(orgId, adminId, baseInput())
    await updateVendor(orgId, adminId, id, baseInput({ name: "Vendor Diubah", type: ["SUPPLIER"] }))
    const rows = await listVendors(orgId)
    const updated = rows.find((v) => v.id === id)
    expect(updated?.name).toBe("Vendor Diubah")
    expect(updated?.type).toEqual(["SUPPLIER"])
  })

  it("rejects updating a nonexistent vendor", async () => {
    await expect(
      updateVendor(orgId, adminId, "00000000-0000-0000-0000-000000000000", baseInput()),
    ).rejects.toThrow(VendorError)
  })

  it("deactivating a vendor removes it from listActiveVendors but not listVendors", async () => {
    const { id } = await createVendor(orgId, adminId, baseInput())
    await setVendorActive(orgId, adminId, id, false)

    const active = await listActiveVendors(orgId)
    expect(active.some((v) => v.id === id)).toBe(false)

    const all = await listVendors(orgId)
    expect(all.some((v) => v.id === id && v.isActive === false)).toBe(true)
  })
})

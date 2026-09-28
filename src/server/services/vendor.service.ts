import "server-only"
import type { VendorFormInput } from "@/lib/validators/vendor"
import { withOrg } from "@/server/db"
import { assertOrgWritable } from "@/server/quota"
import type { Prisma } from "../../../generated/prisma/client"

// FR-04 (docs/02-prd.md §A, v1.1): daftar vendor penyedia/servis/kalibrasi.

export class VendorError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "VendorError"
  }
}

function auditData(
  action: string,
  changes: Record<string, unknown>,
  input: { organizationId: string; actorId: string; vendorId: string },
): Prisma.Args<"auditLog", "create"> {
  return {
    data: {
      organizationId: input.organizationId,
      actorUserId: input.actorId,
      action,
      entityType: "vendor",
      entityId: input.vendorId,
      changes: changes as Prisma.InputJsonValue,
    },
  }
}

export async function createVendor(
  organizationId: string,
  actorUserId: string,
  input: VendorFormInput,
): Promise<{ id: string }> {
  return withOrg(organizationId, async (tx) => {
    await assertOrgWritable(organizationId, tx)
    const vendor = await tx.vendor.create({
      data: {
        organizationId,
        name: input.name,
        type: input.type,
        contactPerson: input.contactPerson,
        phone: input.phone,
        email: input.email,
        address: input.address,
      },
      select: { id: true },
    })
    await tx.auditLog.create(
      auditData(
        "vendor.create",
        { name: input.name },
        {
          organizationId,
          actorId: actorUserId,
          vendorId: vendor.id,
        },
      ),
    )
    return vendor
  })
}

export async function updateVendor(
  organizationId: string,
  actorUserId: string,
  vendorId: string,
  input: VendorFormInput,
): Promise<void> {
  return withOrg(organizationId, async (tx) => {
    await assertOrgWritable(organizationId, tx)
    const existing = await tx.vendor.findFirst({ where: { id: vendorId, organizationId } })
    if (!existing) throw new VendorError("Vendor tidak ditemukan.")

    await tx.vendor.update({
      where: { id: vendorId },
      data: {
        name: input.name,
        type: input.type,
        contactPerson: input.contactPerson,
        phone: input.phone,
        email: input.email,
        address: input.address,
      },
    })

    await tx.auditLog.create(
      auditData(
        "vendor.update",
        { name: { before: existing.name, after: input.name } },
        { organizationId, actorId: actorUserId, vendorId },
      ),
    )
  })
}

export async function setVendorActive(
  organizationId: string,
  actorUserId: string,
  vendorId: string,
  isActive: boolean,
): Promise<void> {
  return withOrg(organizationId, async (tx) => {
    await assertOrgWritable(organizationId, tx)
    const existing = await tx.vendor.findFirst({ where: { id: vendorId, organizationId } })
    if (!existing) throw new VendorError("Vendor tidak ditemukan.")

    const updated = await tx.vendor.update({
      where: { id: vendorId },
      data: { isActive },
      select: { isActive: true },
    })

    await tx.auditLog.create(
      auditData(
        isActive ? "vendor.enable" : "vendor.disable",
        { isActive: { before: existing.isActive, after: updated.isActive } },
        { organizationId, actorId: actorUserId, vendorId },
      ),
    )
  })
}

export type VendorRow = {
  id: string
  name: string
  type: string[]
  contactPerson: string | null
  phone: string | null
  email: string | null
  address: string | null
  isActive: boolean
}

export async function listVendors(organizationId: string): Promise<VendorRow[]> {
  return withOrg(organizationId, (tx) =>
    tx.vendor.findMany({
      where: { organizationId },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        type: true,
        contactPerson: true,
        phone: true,
        email: true,
        address: true,
        isActive: true,
      },
    }),
  )
}

export async function listActiveVendors(
  organizationId: string,
): Promise<{ id: string; name: string }[]> {
  return withOrg(organizationId, (tx) =>
    tx.vendor.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  )
}

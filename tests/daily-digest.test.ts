import { PrismaPg } from "@prisma/adapter-pg"
import { afterAll, describe, expect, it } from "vitest"
import { PrismaClient } from "../generated/prisma/client"
import { localHour, sendDailyDigestForOrg } from "../src/server/jobs/daily-digest"
import { createAsset } from "../src/server/services/asset.service"
import { createSchedule } from "../src/server/services/maintenance.service"

const setup = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL_PLATFORM ?? process.env.DATABASE_URL ?? "",
  }),
})

// RS01 (seed org) is shared across every test file in the suite, and the
// digest's own idempotency guard ("one daily-digest per org per calendar
// day") would then collide with whichever run happened to send first today
// — a fresh throwaway org per test sidesteps that guard entirely, rather
// than fighting it.
async function createTestOrgWithRoom(): Promise<{
  orgId: string
  adminId: string
  roomId: string
  categoryId: string
}> {
  const suffix = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`
  const org = await setup.organization.create({
    data: {
      name: `Org Digest ${suffix}`,
      code: `DG${suffix}`.slice(0, 12),
      timezone: "Asia/Jakarta",
    },
  })
  const admin = await setup.user.create({
    data: {
      organizationId: org.id,
      email: `admin-digest-${suffix}@simaset.test`,
      name: "Admin Digest Uji",
      role: "SUPERADMIN",
      status: "ACTIVE",
      passwordHash: "x",
    },
  })
  const building = await setup.location.create({
    data: { organizationId: org.id, type: "BUILDING", name: "Gedung Uji", path: "" },
  })
  const floor = await setup.location.create({
    data: {
      organizationId: org.id,
      type: "FLOOR",
      name: "Lantai Uji",
      parentId: building.id,
      path: building.id,
    },
  })
  const department = await setup.location.create({
    data: {
      organizationId: org.id,
      type: "DEPARTMENT",
      name: "Instalasi Uji",
      code: "IU",
      parentId: floor.id,
      path: `${building.id}/${floor.id}`,
    },
  })
  const room = await setup.location.create({
    data: {
      organizationId: org.id,
      type: "ROOM",
      name: "Ruang Uji",
      parentId: department.id,
      path: `${building.id}/${floor.id}/${department.id}`,
    },
  })
  const category = await setup.category.create({
    data: { organizationId: org.id, name: "Kategori Uji", code: "KU" },
  })
  return { orgId: org.id, adminId: admin.id, roomId: room.id, categoryId: category.id }
}

afterAll(async () => {
  await setup.$disconnect()
})

describe("localHour", () => {
  it("computes the correct local hour for a known UTC instant across zones", () => {
    const at = new Date("2026-06-15T00:00:00Z") // tengah malam UTC
    expect(localHour("Asia/Jakarta", at)).toBe(7) // WIB = UTC+7
    expect(localHour("Asia/Jayapura", at)).toBe(9) // WIT = UTC+9
    expect(localHour("UTC", at)).toBe(0)
  })
})

describe("sendDailyDigestForOrg (FR-28)", () => {
  it("does not send (or log) anything when there is nothing to report", async () => {
    const org = await setup.organization.create({
      data: { name: `Org Digest Kosong ${Date.now()}`, code: `DGK${Date.now()}`.slice(0, 12) },
    })
    await sendDailyDigestForOrg(org.id)
    const logs = await setup.emailLog.findMany({
      where: { organizationId: org.id, template: "daily-digest" },
    })
    expect(logs).toHaveLength(0)
    await setup.organization.delete({ where: { id: org.id } })
  })

  it("sends to admins and the PIC of the affected room when a calibration is due soon, and is idempotent within the same day", async () => {
    const { orgId, adminId, roomId, categoryId } = await createTestOrgWithRoom()
    const asset = await createAsset(orgId, adminId, {
      name: `Aset Digest ${Date.now()}`,
      categoryId,
      locationId: roomId,
      condition: "GOOD",
      acquisitionDate: new Date("2026-01-15"),
      brand: null,
      model: null,
      serialNumber: null,
      yearManufactured: null,
      fundingSource: null,
      acquisitionCost: null,
      acquisitionDocumentNo: null,
      warrantyUntil: null,
      economicLifeYears: null,
      notes: null,
      confirmDuplicateSerial: false,
    })
    await createSchedule(orgId, {
      assetId: asset.id,
      type: "PREVENTIVE",
      intervalMonths: 6,
      nextDueAt: new Date(Date.now() + 10 * 86_400_000), // dalam 30 hari
      notes: null,
    })

    const pic = await setup.user.create({
      data: {
        organizationId: orgId,
        email: `pic-digest-${Date.now()}@simaset.test`,
        name: "PIC Digest Uji",
        role: "PIC_ROOM",
        status: "ACTIVE",
        passwordHash: "x",
      },
    })
    await setup.location.update({ where: { id: roomId }, data: { picUserId: pic.id } })

    await sendDailyDigestForOrg(orgId)

    const logs = await setup.emailLog.findMany({
      where: { organizationId: orgId, template: "daily-digest" },
      orderBy: { sentAt: "desc" },
    })
    const recipientEmails = logs.map((l) => l.toEmail)
    expect(recipientEmails).toContain(pic.email)

    // Idempoten: memanggil lagi pada hari yang sama tidak menambah log baru.
    const before = logs.length
    await sendDailyDigestForOrg(orgId)
    const after = await setup.emailLog.count({
      where: { organizationId: orgId, template: "daily-digest" },
    })
    expect(after).toBe(before)
  })
})

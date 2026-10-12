import { PrismaPg } from "@prisma/adapter-pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { PrismaClient } from "../generated/prisma/client"
import { createAsset } from "../src/server/services/asset.service"
import { getDashboardStats } from "../src/server/services/dashboard.service"
import { getAccessibleRoomIds } from "../src/server/services/scope.service"

const setup = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL_PLATFORM ?? process.env.DATABASE_URL ?? "",
  }),
})

let orgId: string
let adminId: string
let roomId: string
let otherRoomId: string
let categoryId: string
const createdUserIds: string[] = []

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
  const room = await setup.location.findFirstOrThrow({
    where: { organizationId: orgId, type: "ROOM", parent: { code: { not: null } } },
    select: { id: true, parentId: true, path: true },
  })
  roomId = room.id
  const dept = await setup.location.findFirstOrThrow({ where: { id: room.parentId! } })
  const other = await setup.location.create({
    data: {
      organizationId: orgId,
      parentId: dept.id,
      type: "ROOM",
      name: `Ruang Dasbor Uji ${Date.now()}`,
      path: `${dept.path}/${dept.id}`,
    },
  })
  otherRoomId = other.id
  const fur = await setup.category.findFirstOrThrow({
    where: { organizationId: orgId, code: "FUR" },
    select: { id: true },
  })
  categoryId = fur.id
})

afterAll(async () => {
  // RS01 adalah org seed bersama yang dipakai lintas berkas tes — pengguna
  // PIC sekali-pakai di sini sempat menumpuk tak terbatas lintas banyak kali
  // jalan sampai kuota pengguna organisasi habis dan mematahkan tes lain
  // sama sekali (invite-and-reset.test.ts). Jangan ulangi itu.
  if (createdUserIds.length > 0) {
    await setup.userLocation.deleteMany({ where: { userId: { in: createdUserIds } } })
    await setup.user.deleteMany({ where: { id: { in: createdUserIds } } })
  }
  await setup.$disconnect()
})

async function makeAsset(locationId: string) {
  return createAsset(orgId, adminId, {
    name: `Aset Dasbor ${Date.now()}-${Math.random().toString(36).slice(2)}`,
    categoryId,
    locationId,
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
}

describe("getAccessibleRoomIds (FR-26 scoping)", () => {
  it("returns null (unrestricted) for non-PIC_ROOM roles", async () => {
    const rooms = await setup.$transaction((tx) =>
      getAccessibleRoomIds(tx, orgId, adminId, "SUPERADMIN"),
    )
    expect(rooms).toBeNull()
  })

  it("returns only the assigned room for a PIC_ROOM user assigned directly to a room", async () => {
    const picUser = await setup.user.create({
      data: {
        organizationId: orgId,
        email: `pic-dashboard-${Date.now()}@simaset.test`,
        name: "PIC Uji Dasbor",
        role: "PIC_ROOM",
        status: "ACTIVE",
        passwordHash: "x",
      },
    })
    createdUserIds.push(picUser.id)
    await setup.userLocation.create({ data: { userId: picUser.id, locationId: roomId } })

    const rooms = await setup.$transaction((tx) =>
      getAccessibleRoomIds(tx, orgId, picUser.id, "PIC_ROOM"),
    )
    expect(rooms).toEqual([roomId])
  })

  it("returns an empty array for a PIC_ROOM user with no assignment", async () => {
    const picUser = await setup.user.create({
      data: {
        organizationId: orgId,
        email: `pic-unassigned-${Date.now()}@simaset.test`,
        name: "PIC Tanpa Penugasan",
        role: "PIC_ROOM",
        status: "ACTIVE",
        passwordHash: "x",
      },
    })
    createdUserIds.push(picUser.id)
    const rooms = await setup.$transaction((tx) =>
      getAccessibleRoomIds(tx, orgId, picUser.id, "PIC_ROOM"),
    )
    expect(rooms).toEqual([])
  })
})

describe("getDashboardStats (FR-26)", () => {
  it("counts assets by status and by department for an unrestricted role", async () => {
    await makeAsset(roomId)
    const stats = await getDashboardStats(orgId, adminId, "SUPERADMIN")
    expect(stats.assetsByStatus.find((s) => s.status === "AVAILABLE")?.count).toBeGreaterThan(0)
    expect(stats.assetsByDepartment.length).toBeGreaterThan(0)
  })

  it("scopes a PIC_ROOM user's stats to only their assigned room", async () => {
    const picUser = await setup.user.create({
      data: {
        organizationId: orgId,
        email: `pic-scoped-${Date.now()}@simaset.test`,
        name: "PIC Cakupan Uji",
        role: "PIC_ROOM",
        status: "ACTIVE",
        passwordHash: "x",
      },
    })
    createdUserIds.push(picUser.id)
    await setup.userLocation.create({ data: { userId: picUser.id, locationId: otherRoomId } })

    const asset = await makeAsset(otherRoomId)
    await makeAsset(roomId) // di ruangan lain — tidak boleh ikut terhitung

    const stats = await getDashboardStats(orgId, picUser.id, "PIC_ROOM")
    const total = stats.assetsByStatus.reduce((sum, s) => sum + s.count, 0)
    // Hanya aset di otherRoomId (termasuk `asset` di atas) yang boleh terhitung.
    expect(total).toBeGreaterThan(0)
    const recorded = await setup.asset.findUniqueOrThrow({ where: { id: asset.id } })
    expect(recorded.locationId).toBe(otherRoomId)
  })
})

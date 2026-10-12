import { PrismaPg } from "@prisma/adapter-pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { PrismaClient } from "../generated/prisma/client"
import { createAsset } from "../src/server/services/asset.service"
import { disposeAsset } from "../src/server/services/event.service"
import { checkoutLoan, returnLoan } from "../src/server/services/loan.service"
import {
  createSchedule,
  listSchedulesForAsset,
  recordMaintenanceExecution,
} from "../src/server/services/maintenance.service"
import {
  getCalibrationReport,
  getLoanReport,
  getLostDisposedReport,
  getRoomInventoryReport,
} from "../src/server/services/reports.service"

const setup = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL_PLATFORM ?? process.env.DATABASE_URL ?? "",
  }),
})

let orgId: string
let adminId: string
let roomId: string
let categoryId: string
let medicalCategoryId: string

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
    select: { id: true },
  })
  roomId = room.id
  const fur = await setup.category.findFirstOrThrow({
    where: { organizationId: orgId, code: "FUR" },
    select: { id: true },
  })
  categoryId = fur.id
  const em = await setup.category.findFirstOrThrow({
    where: { organizationId: orgId, code: "EM" },
    select: { id: true },
  })
  medicalCategoryId = em.id
})

afterAll(async () => {
  await setup.$disconnect()
})

function baseInput(overrides: Partial<Parameters<typeof createAsset>[2]> = {}) {
  return {
    name: `Aset Laporan ${Date.now()}-${Math.random().toString(36).slice(2)}`,
    categoryId,
    locationId: roomId,
    condition: "GOOD" as const,
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
    ...overrides,
  }
}

describe("getRoomInventoryReport (FR-27)", () => {
  it("lists only non-disposed assets in the given room", async () => {
    const asset = await createAsset(orgId, adminId, baseInput())
    const rows = await getRoomInventoryReport(orgId, roomId)
    expect(rows.some((r) => r.assetCode === asset.assetCode)).toBe(true)
  })

  it("excludes a disposed asset", async () => {
    const asset = await createAsset(orgId, adminId, baseInput())
    await disposeAsset(orgId, adminId, {
      assetId: asset.id,
      reason: "RUSAK_TOTAL",
      occurredAt: new Date(),
    })
    const rows = await getRoomInventoryReport(orgId, roomId)
    expect(rows.some((r) => r.assetCode === asset.assetCode)).toBe(false)
  })
})

describe("getLoanReport (FR-27)", () => {
  it("includes a loan borrowed within the given date range with its return status", async () => {
    const asset = await createAsset(orgId, adminId, baseInput())
    const { loanId } = await checkoutLoan(orgId, adminId, {
      assetId: asset.id,
      borrowerType: "EXTERNAL_PERSON",
      borrowerName: "Pelapor Uji",
      borrowerPhone: "0812",
      purpose: "Uji laporan",
      dueAt: null,
      conditionOut: "GOOD",
    })
    await returnLoan(orgId, adminId, { loanId, conditionIn: "GOOD", returnNotes: null })

    const rows = await getLoanReport(orgId, {
      from: new Date(Date.now() - 86_400_000),
      to: new Date(Date.now() + 86_400_000),
    })
    const row = rows.find((r) => r.assetCode === asset.assetCode)
    expect(row).toBeDefined()
    expect(row?.returnedAt).not.toBeNull()
  })
})

describe("getCalibrationReport (FR-27)", () => {
  it("includes a calibration execution within range with its result", async () => {
    const asset = await createAsset(orgId, adminId, baseInput({ categoryId: medicalCategoryId }))
    const schedules = await listSchedulesForAsset(orgId, asset.id)
    const schedule = schedules.find((s) => s.type === "CALIBRATION")!

    await recordMaintenanceExecution(orgId, adminId, {
      scheduleId: schedule.id,
      performedAt: new Date("2026-08-01"),
      performedBy: "INTERNAL",
      performedByInternal: "Teknisi Laporan",
      result: "PASS",
      validUntil: null,
      certificateNumber: null,
      certificateObjectKey: null,
      cost: null,
      partsReplaced: null,
      description: null,
    })

    const rows = await getCalibrationReport(orgId, {
      from: new Date("2026-07-01"),
      to: new Date("2026-09-01"),
    })
    const row = rows.find((r) => r.assetCode === asset.assetCode)
    expect(row?.result).toBe("PASS")
    expect(row?.performedBy).toBe("Teknisi Laporan")
  })

  it("does not include a PREVENTIVE-only schedule's execution (CALIBRATION type filter)", async () => {
    const asset = await createAsset(orgId, adminId, baseInput())
    const { id: scheduleId } = await createSchedule(orgId, {
      assetId: asset.id,
      type: "PREVENTIVE",
      intervalMonths: 6,
      nextDueAt: new Date("2026-12-01"),
      notes: null,
    })
    await recordMaintenanceExecution(orgId, adminId, {
      scheduleId,
      performedAt: new Date("2026-08-05"),
      performedBy: "INTERNAL",
      performedByInternal: "Teknisi Preventif",
      result: "PASS",
      validUntil: null,
      certificateNumber: null,
      certificateObjectKey: null,
      cost: null,
      partsReplaced: null,
      description: null,
    })
    const rows = await getCalibrationReport(orgId, {
      from: new Date("2026-07-01"),
      to: new Date("2026-09-01"),
    })
    expect(rows.some((r) => r.assetCode === asset.assetCode)).toBe(false)
  })
})

describe("getLostDisposedReport (FR-27)", () => {
  it("includes a disposed asset with its reason and date", async () => {
    const asset = await createAsset(orgId, adminId, baseInput())
    await disposeAsset(orgId, adminId, {
      assetId: asset.id,
      reason: "DIHIBAHKAN",
      occurredAt: new Date(),
    })
    const rows = await getLostDisposedReport(orgId)
    const row = rows.find((r) => r.assetCode === asset.assetCode)
    expect(row?.status).toBe("DISPOSED")
    expect(row?.disposalReason).toBe("DIHIBAHKAN")
  })

  it("includes an asset marked LOST", async () => {
    const asset = await createAsset(orgId, adminId, baseInput())
    await setup.asset.update({ where: { id: asset.id }, data: { status: "LOST" } })
    const rows = await getLostDisposedReport(orgId)
    expect(rows.some((r) => r.assetCode === asset.assetCode && r.status === "LOST")).toBe(true)
  })
})

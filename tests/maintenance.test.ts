import { PrismaPg } from "@prisma/adapter-pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { PrismaClient } from "../generated/prisma/client"
import { createAsset } from "../src/server/services/asset.service"
import {
  createSchedule,
  getCertificateDownloadUrl,
  listDueSchedules,
  listSchedulesForAsset,
  MaintenanceError,
  recordMaintenanceExecution,
  requestCertificateUpload,
  setScheduleActive,
} from "../src/server/services/maintenance.service"
import { createVendor } from "../src/server/services/vendor.service"

const setup = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL_PLATFORM ?? process.env.DATABASE_URL ?? "",
  }),
})

let orgId: string
let adminId: string
let roomId: string
let departmentId: string
let medicalCategoryId: string
let nonMedicalCategoryId: string

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
    where: { organizationId: orgId, type: "ROOM" },
    select: { id: true, parentId: true },
  })
  roomId = room.id
  departmentId = room.parentId!
  const em = await setup.category.findFirstOrThrow({
    where: { organizationId: orgId, code: "EM" },
    select: { id: true },
  })
  medicalCategoryId = em.id
  const fur = await setup.category.findFirstOrThrow({
    where: { organizationId: orgId, code: "FUR" },
    select: { id: true },
  })
  nonMedicalCategoryId = fur.id
})

afterAll(async () => {
  await setup.$disconnect()
})

async function makeAsset(categoryId: string) {
  return createAsset(orgId, adminId, {
    name: `Aset Pemeliharaan ${Date.now()}-${Math.random().toString(36).slice(2)}`,
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
}

describe("createSchedule / listSchedulesForAsset (FR-21)", () => {
  it("creates a manual PREVENTIVE schedule for a non-medical asset", async () => {
    const asset = await makeAsset(nonMedicalCategoryId)
    const { id } = await createSchedule(orgId, {
      assetId: asset.id,
      type: "PREVENTIVE",
      intervalMonths: 6,
      nextDueAt: new Date("2026-12-01"),
      notes: null,
    })
    const schedules = await listSchedulesForAsset(orgId, asset.id)
    expect(schedules.some((s) => s.id === id && s.type === "PREVENTIVE")).toBe(true)
  })

  it("a medical asset already has an auto-created CALIBRATION schedule from createAsset", async () => {
    const asset = await makeAsset(medicalCategoryId)
    const schedules = await listSchedulesForAsset(orgId, asset.id)
    expect(schedules.some((s) => s.type === "CALIBRATION")).toBe(true)
  })

  it("setScheduleActive deactivates a schedule", async () => {
    const asset = await makeAsset(nonMedicalCategoryId)
    const { id } = await createSchedule(orgId, {
      assetId: asset.id,
      type: "PREVENTIVE",
      intervalMonths: 3,
      nextDueAt: new Date("2026-11-01"),
      notes: null,
    })
    await setScheduleActive(orgId, id, false)
    const schedules = await listSchedulesForAsset(orgId, asset.id)
    expect(schedules.find((s) => s.id === id)?.isActive).toBe(false)
  })
})

describe("recordMaintenanceExecution (FR-22)", () => {
  it("PASS recalculates nextDueAt from performedAt + interval and writes a CALIBRATION event", async () => {
    const asset = await makeAsset(medicalCategoryId)
    const schedules = await listSchedulesForAsset(orgId, asset.id)
    const schedule = schedules.find((s) => s.type === "CALIBRATION")!

    await recordMaintenanceExecution(orgId, adminId, {
      scheduleId: schedule.id,
      performedAt: new Date("2026-06-01"),
      performedBy: "INTERNAL",
      performedByInternal: "Teknisi A",
      result: "PASS",
      validUntil: null,
      certificateNumber: null,
      certificateObjectKey: null,
      cost: null,
      partsReplaced: null,
      description: "Kalibrasi rutin",
    })

    const updated = await setup.maintenanceSchedule.findUniqueOrThrow({
      where: { id: schedule.id },
    })
    expect(updated.lastPerformedAt?.toISOString().slice(0, 10)).toBe("2026-06-01")
    expect(updated.nextDueAt.getUTCFullYear()).toBe(2027)
    expect(updated.nextDueAt.getUTCMonth()).toBe(5) // Juni (0-indexed) + 12 bulan interval

    const event = await setup.assetEvent.findFirstOrThrow({
      where: { assetId: asset.id, type: "CALIBRATION" },
    })
    expect(event.statusAfter).toBeNull()

    const after = await setup.asset.findUniqueOrThrow({ where: { id: asset.id } })
    expect(after.status).toBe("AVAILABLE")
  })

  it("validUntil overrides the interval-based nextDueAt (mengikuti tanggal sertifikat)", async () => {
    const asset = await makeAsset(medicalCategoryId)
    const schedules = await listSchedulesForAsset(orgId, asset.id)
    const schedule = schedules.find((s) => s.type === "CALIBRATION")!

    await recordMaintenanceExecution(orgId, adminId, {
      scheduleId: schedule.id,
      performedAt: new Date("2026-06-01"),
      performedBy: "INTERNAL",
      performedByInternal: "Teknisi A",
      result: "PASS",
      validUntil: new Date("2028-01-15"),
      certificateNumber: "CERT-001",
      certificateObjectKey: null,
      cost: null,
      partsReplaced: null,
      description: null,
    })

    const updated = await setup.maintenanceSchedule.findUniqueOrThrow({
      where: { id: schedule.id },
    })
    expect(updated.nextDueAt.toISOString().slice(0, 10)).toBe("2028-01-15")
  })

  it("FAIL locks the asset to DAMAGED with a statusBefore/After transition", async () => {
    const asset = await makeAsset(medicalCategoryId)
    const schedules = await listSchedulesForAsset(orgId, asset.id)
    const schedule = schedules.find((s) => s.type === "CALIBRATION")!

    await recordMaintenanceExecution(orgId, adminId, {
      scheduleId: schedule.id,
      performedAt: new Date("2026-06-01"),
      performedBy: "INTERNAL",
      performedByInternal: "Teknisi A",
      result: "FAIL",
      validUntil: null,
      certificateNumber: null,
      certificateObjectKey: null,
      cost: null,
      partsReplaced: null,
      description: "Tidak lulus uji akurasi",
    })

    const after = await setup.asset.findUniqueOrThrow({ where: { id: asset.id } })
    expect(after.status).toBe("DAMAGED")

    const event = await setup.assetEvent.findFirstOrThrow({
      where: { assetId: asset.id, type: "CALIBRATION" },
    })
    expect(event.statusBefore).toBe("AVAILABLE")
    expect(event.statusAfter).toBe("DAMAGED")
  })

  it("requires a vendor id when performedBy is a vendor lookup by service, not just validator", async () => {
    const vendor = await createVendor(orgId, adminId, {
      name: `Vendor Kalibrasi ${Date.now()}`,
      type: ["CALIBRATION"],
      contactPerson: null,
      phone: null,
      email: null,
      address: null,
    })
    const asset = await makeAsset(medicalCategoryId)
    const schedules = await listSchedulesForAsset(orgId, asset.id)
    const schedule = schedules.find((s) => s.type === "CALIBRATION")!

    const { recordId } = await recordMaintenanceExecution(orgId, adminId, {
      scheduleId: schedule.id,
      performedAt: new Date("2026-06-01"),
      performedBy: "VENDOR",
      performedByVendorId: vendor.id,
      performedByInternal: null,
      result: "PASS",
      validUntil: null,
      certificateNumber: null,
      certificateObjectKey: null,
      cost: null,
      partsReplaced: null,
      description: null,
    })
    const record = await setup.maintenanceRecord.findUniqueOrThrow({ where: { id: recordId } })
    expect(record.performedByVendorId).toBe(vendor.id)
  })

  it("rejects recording against an unknown schedule", async () => {
    await expect(
      recordMaintenanceExecution(orgId, adminId, {
        scheduleId: "00000000-0000-0000-0000-000000000000",
        performedAt: new Date(),
        performedBy: "INTERNAL",
        performedByInternal: "X",
        result: "PASS",
        validUntil: null,
        certificateNumber: null,
        certificateObjectKey: null,
        cost: null,
        partsReplaced: null,
        description: null,
      }),
    ).rejects.toThrow(MaintenanceError)
  })
})

describe("certificate presign (FR-22)", () => {
  it("issues a presigned upload URL scoped under the asset/schedule", async () => {
    const asset = await makeAsset(medicalCategoryId)
    const schedules = await listSchedulesForAsset(orgId, asset.id)
    const schedule = schedules.find((s) => s.type === "CALIBRATION")!

    const { uploadUrl, objectKey } = await requestCertificateUpload(orgId, {
      assetId: asset.id,
      scheduleId: schedule.id,
      contentType: "application/pdf",
      sizeBytes: 50_000,
    })
    expect(objectKey).toContain(asset.id)
    expect(objectKey).toContain(schedule.id)
    expect(uploadUrl).toContain(objectKey)
  })

  it("getCertificateDownloadUrl rejects a record with no certificate", async () => {
    const asset = await makeAsset(medicalCategoryId)
    const schedules = await listSchedulesForAsset(orgId, asset.id)
    const schedule = schedules.find((s) => s.type === "CALIBRATION")!
    const { recordId } = await recordMaintenanceExecution(orgId, adminId, {
      scheduleId: schedule.id,
      performedAt: new Date("2026-06-01"),
      performedBy: "INTERNAL",
      performedByInternal: "Teknisi A",
      result: "PASS",
      validUntil: null,
      certificateNumber: null,
      certificateObjectKey: null,
      cost: null,
      partsReplaced: null,
      description: null,
    })
    await expect(getCertificateDownloadUrl(orgId, recordId)).rejects.toThrow(MaintenanceError)
  })
})

describe("listDueSchedules (FR-23)", () => {
  it("buckets an overdue schedule as OVERDUE and filters by department", async () => {
    const asset = await makeAsset(nonMedicalCategoryId)
    await createSchedule(orgId, {
      assetId: asset.id,
      type: "PREVENTIVE",
      intervalMonths: 6,
      nextDueAt: new Date(Date.now() - 86_400_000),
      notes: null,
    })

    const all = await listDueSchedules(orgId)
    const row = all.find((r) => r.assetId === asset.id)
    expect(row?.bucket).toBe("OVERDUE")

    const filtered = await listDueSchedules(orgId, { departmentId })
    expect(filtered.some((r) => r.assetId === asset.id)).toBe(true)

    const filteredWrongCategory = await listDueSchedules(orgId, { categoryId: medicalCategoryId })
    expect(filteredWrongCategory.some((r) => r.assetId === asset.id)).toBe(false)
  })
})

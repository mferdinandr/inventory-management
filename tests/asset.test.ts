import { PrismaPg } from "@prisma/adapter-pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { PrismaClient } from "../generated/prisma/client"
import {
  AssetError,
  createAsset,
  DuplicateSerialError,
  findAssetIdByCode,
  findAssetIdByPublicId,
  getAssetDetail,
  listAssets,
  recordLabelPrint,
} from "../src/server/services/asset.service"
import { getPublicAsset } from "../src/server/services/public-asset.service"

const setup = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL_PLATFORM ?? process.env.DATABASE_URL ?? "",
  }),
})

let orgId: string
let adminId: string
let roomId: string
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
    select: { id: true },
  })
  roomId = room.id
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

function baseInput(overrides: Partial<Parameters<typeof createAsset>[2]> = {}) {
  return {
    name: `Aset Uji ${Date.now()}-${Math.random().toString(36).slice(2)}`,
    categoryId: nonMedicalCategoryId,
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

describe("createAsset", () => {
  it("generates a code formatted {org}-{dept}-{year}-{seq} and a 12-char public_id", async () => {
    const asset = await createAsset(orgId, adminId, baseInput())
    expect(asset.publicId).toMatch(/^[A-Za-z0-9]{12}$/)
    expect(asset.assetCode).toMatch(/^RS01-RAD-2026-\d{4}$/)
  })

  it("two assets registered back to back get consecutive sequence numbers", async () => {
    const a = await createAsset(orgId, adminId, baseInput())
    const b = await createAsset(orgId, adminId, baseInput())
    const seqA = Number(a.assetCode.split("-").at(-1))
    const seqB = Number(b.assetCode.split("-").at(-1))
    expect(seqB).toBe(seqA + 1)
  })

  it("writes a CREATED event automatically (FR-15)", async () => {
    const asset = await createAsset(orgId, adminId, baseInput())
    const detail = await getAssetDetail(orgId, asset.id)
    const created = detail?.events.find((e) => e.type === "CREATED")
    expect(created).toBeDefined()
    expect(created?.statusAfter).toBe("AVAILABLE")
  })

  it("auto-creates a calibration schedule for a medical-device category, not for a non-medical one", async () => {
    const medical = await createAsset(
      orgId,
      adminId,
      baseInput({ categoryId: medicalCategoryId, acquisitionDate: new Date("2026-01-01") }),
    )
    const nonMedical = await createAsset(orgId, adminId, baseInput())

    const medicalSchedule = await setup.maintenanceSchedule.findFirst({
      where: { assetId: medical.id },
    })
    expect(medicalSchedule).not.toBeNull()
    expect(medicalSchedule?.type).toBe("CALIBRATION")
    expect(medicalSchedule?.intervalMonths).toBe(12)
    expect(medicalSchedule?.nextDueAt.getUTCFullYear()).toBe(2027) // +12 bulan

    const nonMedicalSchedule = await setup.maintenanceSchedule.findFirst({
      where: { assetId: nonMedical.id },
    })
    expect(nonMedicalSchedule).toBeNull()
  })

  it("warns on duplicate serial and requires explicit confirmation to proceed", async () => {
    const serial = `SN-DUPE-${Date.now()}`
    const first = await createAsset(orgId, adminId, baseInput({ serialNumber: serial }))

    await expect(createAsset(orgId, adminId, baseInput({ serialNumber: serial }))).rejects.toThrow(
      DuplicateSerialError,
    )

    const confirmed = await createAsset(
      orgId,
      adminId,
      baseInput({ serialNumber: serial, confirmDuplicateSerial: true }),
    )
    expect(confirmed.id).not.toBe(first.id)
  })

  it("rejects registration in a room whose department has no code yet", async () => {
    const buildingLess = await setup.location.create({
      data: { organizationId: orgId, type: "BUILDING", name: "Gedung Uji Tanpa Kode", path: "" },
    })
    const floor = await setup.location.create({
      data: {
        organizationId: orgId,
        type: "FLOOR",
        name: "Lantai Uji",
        parentId: buildingLess.id,
        path: buildingLess.id,
      },
    })
    const dept = await setup.location.create({
      data: {
        organizationId: orgId,
        type: "DEPARTMENT",
        name: "Instalasi Tanpa Kode",
        parentId: floor.id,
        path: `${buildingLess.id}/${floor.id}`,
        code: null,
      },
    })
    const room = await setup.location.create({
      data: {
        organizationId: orgId,
        type: "ROOM",
        name: "Ruang Uji",
        parentId: dept.id,
        path: `${buildingLess.id}/${floor.id}/${dept.id}`,
      },
    })

    await expect(createAsset(orgId, adminId, baseInput({ locationId: room.id }))).rejects.toThrow(
      AssetError,
    )
  })
})

describe("listAssets", () => {
  it("filters by search text across name and asset code", async () => {
    const unique = `Termometer-${Date.now()}`
    const asset = await createAsset(orgId, adminId, baseInput({ name: unique }))
    const { items } = await listAssets(orgId, { q: unique })
    expect(items).toHaveLength(1)
    expect(items[0]?.id).toBe(asset.id)
  })

  it("excludes DISPOSED assets by default", async () => {
    const asset = await createAsset(orgId, adminId, baseInput())
    await setup.asset.update({ where: { id: asset.id }, data: { status: "DISPOSED" } })
    const { items } = await listAssets(orgId, { q: asset.assetCode })
    expect(items).toHaveLength(0)
    const { items: withDisposed } = await listAssets(orgId, {
      q: asset.assetCode,
      includeDisposed: true,
    })
    expect(withDisposed).toHaveLength(1)
  })
})

describe("recordLabelPrint", () => {
  it("records a print, sets qrFirstPrintedAt only on the first print, and logs a LABEL_PRINTED event", async () => {
    const asset = await createAsset(orgId, adminId, baseInput())

    await recordLabelPrint(orgId, adminId, asset.id, "FIRST_PRINT", "50x30mm")
    const afterFirst = await setup.asset.findUniqueOrThrow({ where: { id: asset.id } })
    expect(afterFirst.qrFirstPrintedAt).not.toBeNull()
    const firstPrintedAt = afterFirst.qrFirstPrintedAt

    await recordLabelPrint(orgId, adminId, asset.id, "LABEL_FADED", "50x30mm")
    const afterSecond = await setup.asset.findUniqueOrThrow({ where: { id: asset.id } })
    expect(afterSecond.qrFirstPrintedAt?.getTime()).toBe(firstPrintedAt?.getTime())

    const prints = await setup.labelPrint.findMany({ where: { assetId: asset.id } })
    expect(prints).toHaveLength(2)

    const detail = await getAssetDetail(orgId, asset.id)
    const printEvents = detail?.events.filter((e) => e.type === "LABEL_PRINTED")
    expect(printEvents).toHaveLength(2)
  })
})

describe("getPublicAsset (FR-24)", () => {
  it("returns only the safe fields for a known public_id", async () => {
    const asset = await createAsset(
      orgId,
      adminId,
      baseInput({ serialNumber: `SN-PUBLIC-${Date.now()}` }),
    )
    const publicView = await getPublicAsset(asset.publicId)
    expect(publicView).not.toBeNull()
    expect(publicView?.assetCode).toBe(asset.assetCode)
    expect(publicView?.organizationName).toBeTruthy()
    // TypeScript's own type already excludes these, but the real guarantee is
    // at the database role (see tests/tenant-isolation.test.ts's sibling
    // check in db-public); this just confirms the service's shape matches.
    expect(publicView).not.toHaveProperty("serialNumber")
    expect(publicView).not.toHaveProperty("acquisitionCost")
  })

  it("returns null for an unknown public_id — never throws, never leaks which orgs exist", async () => {
    const result = await getPublicAsset("does-not-exist-000000")
    expect(result).toBeNull()
  })

  it("reflects a CALIBRATION schedule's next due date", async () => {
    const asset = await createAsset(
      orgId,
      adminId,
      baseInput({ categoryId: medicalCategoryId, acquisitionDate: new Date("2026-03-01") }),
    )
    const publicView = await getPublicAsset(asset.publicId)
    expect(publicView?.nextCalibrationDue).toBe("2027-03-01")
  })
})

describe("scan resolvers (FR-25)", () => {
  it("finds an asset by public_id (QR) and by asset_code (manual entry, case-insensitive)", async () => {
    const asset = await createAsset(orgId, adminId, baseInput())

    expect(await findAssetIdByPublicId(orgId, asset.publicId)).toBe(asset.id)
    expect(await findAssetIdByCode(orgId, asset.assetCode)).toBe(asset.id)
    expect(await findAssetIdByCode(orgId, asset.assetCode.toLowerCase())).toBe(asset.id)
  })

  it("returns null for a code that doesn't exist", async () => {
    expect(await findAssetIdByPublicId(orgId, "tidak-ada-00000000")).toBeNull()
    expect(await findAssetIdByCode(orgId, "TIDAK-ADA-0000")).toBeNull()
  })

  it("never resolves an asset belonging to a different organization (RLS, not app-level filtering)", async () => {
    const otherOrg = await setup.organization.findFirstOrThrow({
      where: { code: "RS02" },
      select: { id: true },
    })
    const otherAdmin = await setup.user.findFirstOrThrow({
      where: { organizationId: otherOrg.id, role: "SUPERADMIN" },
      select: { id: true },
    })
    const otherRoom = await setup.location.findFirstOrThrow({
      where: { organizationId: otherOrg.id, type: "ROOM" },
      select: { id: true },
    })
    const otherCategory = await setup.category.findFirstOrThrow({
      where: { organizationId: otherOrg.id, code: "FUR" },
      select: { id: true },
    })
    const foreignAsset = await createAsset(otherOrg.id, otherAdmin.id, {
      ...baseInput(),
      locationId: otherRoom.id,
      categoryId: otherCategory.id,
    })

    expect(await findAssetIdByPublicId(orgId, foreignAsset.publicId)).toBeNull()
    expect(await findAssetIdByCode(orgId, foreignAsset.assetCode)).toBeNull()
  })
})

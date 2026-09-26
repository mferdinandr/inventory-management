import { PrismaPg } from "@prisma/adapter-pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { PrismaClient } from "../generated/prisma/client"
import { assertManualTransition, InvalidStatusTransitionError } from "../src/lib/status-machine"
import { createAsset } from "../src/server/services/asset.service"
import {
  AttachmentError,
  confirmAttachment,
  requestAttachmentUpload,
} from "../src/server/services/attachment.service"
import {
  correctEvent,
  disposeAsset,
  EventError,
  recordHistoryEvent,
  revertDisposal,
  transferAsset,
} from "../src/server/services/event.service"

const setup = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL_PLATFORM ?? process.env.DATABASE_URL ?? "",
  }),
})

let orgId: string
let adminId: string
let roomId: string
let categoryId: string

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
  const fur = await setup.category.findFirstOrThrow({
    where: { organizationId: orgId, code: "FUR" },
    select: { id: true },
  })
  categoryId = fur.id
})

afterAll(async () => {
  await setup.$disconnect()
})

async function makeAsset(overrides: Partial<{ locationId: string }> = {}) {
  return createAsset(orgId, adminId, {
    name: `Aset Riwayat ${Date.now()}-${Math.random().toString(36).slice(2)}`,
    categoryId,
    locationId: overrides.locationId ?? roomId,
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

describe("status-machine (FR-09)", () => {
  it("allows AVAILABLE -> UNDER_REPAIR and rejects DISPOSED -> ON_LOAN", () => {
    expect(() => assertManualTransition("AVAILABLE", "UNDER_REPAIR")).not.toThrow()
    expect(() => assertManualTransition("DISPOSED", "ON_LOAN")).toThrow(
      InvalidStatusTransitionError,
    )
  })

  it("never allows a manual transition into or out of ON_LOAN", () => {
    expect(() => assertManualTransition("AVAILABLE", "ON_LOAN")).toThrow()
    expect(() => assertManualTransition("ON_LOAN", "AVAILABLE")).toThrow()
  })
})

describe("recordHistoryEvent (FR-15)", () => {
  it("records a NOTE without touching status", async () => {
    const asset = await makeAsset()
    const { eventId } = await recordHistoryEvent(orgId, adminId, {
      assetId: asset.id,
      type: "NOTE",
      title: "Catatan rutin",
      notes: "Tidak ada masalah.",
      occurredAt: new Date(),
    })
    const event = await setup.assetEvent.findUniqueOrThrow({ where: { id: eventId } })
    expect(event.statusAfter).toBeNull()
    const after = await setup.asset.findUniqueOrThrow({ where: { id: asset.id } })
    expect(after.status).toBe("AVAILABLE")
  })

  it("STATUS_CHANGE validates the transition and updates the asset", async () => {
    const asset = await makeAsset()
    const { eventId } = await recordHistoryEvent(orgId, adminId, {
      assetId: asset.id,
      type: "STATUS_CHANGE",
      title: "Ditemukan rusak",
      occurredAt: new Date(),
      newStatus: "DAMAGED",
    })
    const event = await setup.assetEvent.findUniqueOrThrow({ where: { id: eventId } })
    expect(event.statusBefore).toBe("AVAILABLE")
    expect(event.statusAfter).toBe("DAMAGED")
    const after = await setup.asset.findUniqueOrThrow({ where: { id: asset.id } })
    expect(after.status).toBe("DAMAGED")
  })

  it("rejects an invalid STATUS_CHANGE transition", async () => {
    const asset = await makeAsset()
    await expect(
      recordHistoryEvent(orgId, adminId, {
        assetId: asset.id,
        type: "STATUS_CHANGE",
        title: "Coba lompat status",
        occurredAt: new Date(),
        newStatus: "AT_VENDOR",
      }),
    ).resolves.toBeTruthy() // AVAILABLE -> AT_VENDOR is valid; sanity check first

    await setup.asset.update({ where: { id: asset.id }, data: { status: "DISPOSED" } })
    await expect(
      recordHistoryEvent(orgId, adminId, {
        assetId: asset.id,
        type: "STATUS_CHANGE",
        title: "Tidak boleh",
        occurredAt: new Date(),
        newStatus: "AVAILABLE",
      }),
    ).rejects.toThrow(EventError)
  })
})

describe("transferAsset (FR-10)", () => {
  it("moves the asset and its PIC follows the destination room's PIC", async () => {
    const pic = await setup.user.findFirstOrThrow({
      where: { organizationId: orgId },
      select: { id: true },
    })
    const destination = await setup.location.create({
      data: {
        organizationId: orgId,
        parentId: (
          await setup.location.findFirstOrThrow({
            where: { id: roomId },
            select: { parentId: true },
          })
        ).parentId,
        type: "ROOM",
        name: `Ruang Tujuan ${Date.now()}`,
        path: (
          await setup.location.findFirstOrThrow({ where: { id: roomId }, select: { path: true } })
        ).path,
        picUserId: pic.id,
      },
    })

    const asset = await makeAsset()
    await transferAsset(orgId, adminId, {
      assetId: asset.id,
      toLocationId: destination.id,
      reason: "Reorganisasi ruangan",
      occurredAt: new Date(),
    })

    const after = await setup.asset.findUniqueOrThrow({ where: { id: asset.id } })
    expect(after.locationId).toBe(destination.id)
    expect(after.responsibleUserId).toBe(pic.id)
  })

  it("refuses to transfer an asset that is ON_LOAN", async () => {
    const asset = await makeAsset()
    await setup.asset.update({ where: { id: asset.id }, data: { status: "ON_LOAN" } })
    await expect(
      transferAsset(orgId, adminId, {
        assetId: asset.id,
        toLocationId: roomId,
        reason: "Coba",
        occurredAt: new Date(),
      }),
    ).rejects.toThrow(EventError)
  })
})

describe("disposeAsset + revertDisposal (FR-11)", () => {
  it("disposes an asset and reverts it back to its prior status within the 30-day window", async () => {
    const asset = await makeAsset()
    await recordHistoryEvent(orgId, adminId, {
      assetId: asset.id,
      type: "STATUS_CHANGE",
      title: "Rusak",
      occurredAt: new Date(),
      newStatus: "DAMAGED",
    })

    await disposeAsset(orgId, adminId, {
      assetId: asset.id,
      reason: "RUSAK_TOTAL",
      occurredAt: new Date(),
    })
    const disposed = await setup.asset.findUniqueOrThrow({ where: { id: asset.id } })
    expect(disposed.status).toBe("DISPOSED")
    expect(disposed.statusBeforeDisposal).toBe("DAMAGED")
    expect(disposed.disposalRevertUntil).not.toBeNull()

    await revertDisposal(orgId, adminId, asset.id)
    const restored = await setup.asset.findUniqueOrThrow({ where: { id: asset.id } })
    expect(restored.status).toBe("DAMAGED")
    expect(restored.disposalRevertUntil).toBeNull()

    const correction = await setup.assetEvent.findFirstOrThrow({
      where: { assetId: asset.id, type: "CORRECTION" },
    })
    expect(correction.statusBefore).toBe("DISPOSED")
    expect(correction.statusAfter).toBe("DAMAGED")
  })

  it("refuses to revert once the 30-day window has passed", async () => {
    const asset = await makeAsset()
    await disposeAsset(orgId, adminId, {
      assetId: asset.id,
      reason: "HILANG",
      occurredAt: new Date(),
    })
    await setup.asset.update({
      where: { id: asset.id },
      data: { disposalRevertUntil: new Date(Date.now() - 1000) },
    })
    await expect(revertDisposal(orgId, adminId, asset.id)).rejects.toThrow(EventError)
  })
})

describe("correctEvent (FR-16)", () => {
  it("creates a CORRECTION event pointing at the original, leaving the original untouched", async () => {
    const asset = await makeAsset()
    const { eventId: originalId } = await recordHistoryEvent(orgId, adminId, {
      assetId: asset.id,
      type: "NOTE",
      title: "Catatan keliru",
      occurredAt: new Date(),
    })

    const { eventId: correctionId } = await correctEvent(
      orgId,
      adminId,
      originalId,
      "Salah tulis judul, seharusnya lain.",
    )

    const original = await setup.assetEvent.findUniqueOrThrow({ where: { id: originalId } })
    expect(original.title).toBe("Catatan keliru") // tidak diubah

    const correction = await setup.assetEvent.findUniqueOrThrow({ where: { id: correctionId } })
    expect(correction.correctsEventId).toBe(originalId)
    expect(correction.type).toBe("CORRECTION")
  })
})

describe("attachment.service (FR-17)", () => {
  it("issues a presigned upload URL and records the attachment after confirmation", async () => {
    const asset = await makeAsset()
    const { eventId } = await recordHistoryEvent(orgId, adminId, {
      assetId: asset.id,
      type: "NOTE",
      title: "Dengan foto",
      occurredAt: new Date(),
    })

    const { uploadUrl, objectKey } = await requestAttachmentUpload(orgId, {
      eventId,
      contentType: "image/jpeg",
      sizeBytes: 100_000,
      originalFilename: "kondisi.jpg",
    })
    expect(uploadUrl).toContain(objectKey)

    const before = await setup.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { usedStorageBytes: true },
    })

    const { attachmentId } = await confirmAttachment(orgId, adminId, {
      eventId,
      objectKey,
      mimeType: "image/jpeg",
      sizeBytes: 100_000,
      originalFilename: "kondisi.jpg",
    })
    expect(attachmentId).toBeTruthy()

    const after = await setup.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { usedStorageBytes: true },
    })
    expect(after.usedStorageBytes - before.usedStorageBytes).toBe(BigInt(100_000))
  })

  it("refuses a 6th attachment on the same event", async () => {
    const asset = await makeAsset()
    const { eventId } = await recordHistoryEvent(orgId, adminId, {
      assetId: asset.id,
      type: "NOTE",
      title: "Banyak foto",
      occurredAt: new Date(),
    })

    for (let i = 0; i < 5; i++) {
      const { objectKey } = await requestAttachmentUpload(orgId, {
        eventId,
        contentType: "image/jpeg",
        sizeBytes: 1000,
      })
      await confirmAttachment(orgId, adminId, {
        eventId,
        objectKey,
        mimeType: "image/jpeg",
        sizeBytes: 1000,
      })
    }

    await expect(
      requestAttachmentUpload(orgId, { eventId, contentType: "image/jpeg", sizeBytes: 1000 }),
    ).rejects.toThrow(AttachmentError)
  })
})

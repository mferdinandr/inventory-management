import "server-only"
import type { RecordExecutionInput, ScheduleFormInput } from "@/lib/validators/maintenance"
import { withOrg } from "@/server/db"
import { assertOrgWritable, assertStorageQuota } from "@/server/quota"
import { objectKeyForCertificate, presignDownload, presignUpload } from "@/server/storage"
import type { Prisma } from "../../../generated/prisma/client"

// FR-21/FR-22/FR-23 (docs/02-prd.md §F, v1.1). Jadwal dan pelaksanaan
// terpisah dari asset_events: pelaksanaan MENULIS satu asset_events (jejak
// riwayat aset) DAN satu maintenance_records (detail teknis: hasil,
// sertifikat, biaya) yang saling menunjuk lewat event_id.

export class MaintenanceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "MaintenanceError"
  }
}

type Tx = Prisma.TransactionClient

async function loadAssetOrThrow(tx: Tx, organizationId: string, assetId: string) {
  const asset = await tx.asset.findFirst({
    where: { id: assetId, organizationId },
    select: { id: true, status: true, locationId: true },
  })
  if (!asset) throw new MaintenanceError("Aset tidak ditemukan.")
  return asset
}

export async function createSchedule(
  organizationId: string,
  input: ScheduleFormInput,
): Promise<{ id: string }> {
  return withOrg(organizationId, async (tx) => {
    await assertOrgWritable(organizationId, tx)
    await loadAssetOrThrow(tx, organizationId, input.assetId)

    const schedule = await tx.maintenanceSchedule.create({
      data: {
        organizationId,
        assetId: input.assetId,
        type: input.type,
        intervalMonths: input.intervalMonths,
        nextDueAt: input.nextDueAt,
        notes: input.notes,
      },
      select: { id: true },
    })
    return schedule
  })
}

export async function updateSchedule(
  organizationId: string,
  scheduleId: string,
  input: Pick<ScheduleFormInput, "intervalMonths" | "nextDueAt" | "notes">,
): Promise<void> {
  return withOrg(organizationId, async (tx) => {
    await assertOrgWritable(organizationId, tx)
    const existing = await tx.maintenanceSchedule.findFirst({
      where: { id: scheduleId, organizationId },
    })
    if (!existing) throw new MaintenanceError("Jadwal tidak ditemukan.")

    await tx.maintenanceSchedule.update({
      where: { id: scheduleId },
      data: {
        intervalMonths: input.intervalMonths,
        nextDueAt: input.nextDueAt,
        notes: input.notes,
      },
    })
  })
}

export async function setScheduleActive(
  organizationId: string,
  scheduleId: string,
  isActive: boolean,
): Promise<void> {
  return withOrg(organizationId, async (tx) => {
    await assertOrgWritable(organizationId, tx)
    const existing = await tx.maintenanceSchedule.findFirst({
      where: { id: scheduleId, organizationId },
    })
    if (!existing) throw new MaintenanceError("Jadwal tidak ditemukan.")
    await tx.maintenanceSchedule.update({ where: { id: scheduleId }, data: { isActive } })
  })
}

export type ScheduleRow = {
  id: string
  type: string
  intervalMonths: number
  lastPerformedAt: Date | null
  nextDueAt: Date
  isActive: boolean
  notes: string | null
}

export async function listSchedulesForAsset(
  organizationId: string,
  assetId: string,
): Promise<ScheduleRow[]> {
  return withOrg(organizationId, (tx) =>
    tx.maintenanceSchedule.findMany({
      where: { organizationId, assetId },
      orderBy: { nextDueAt: "asc" },
      select: {
        id: true,
        type: true,
        intervalMonths: true,
        lastPerformedAt: true,
        nextDueAt: true,
        isActive: true,
        notes: true,
      },
    }),
  )
}

const EVENT_TITLES: Record<string, string> = {
  CALIBRATION: "Kalibrasi dilaksanakan",
  PREVENTIVE: "Pemeliharaan preventif dilaksanakan",
  CORRECTIVE: "Perbaikan korektif dilaksanakan",
}

/**
 * FR-22: mencatat pelaksanaan kalibrasi/pemeliharaan. Hasil "tidak lulus"
 * mengunci alat: status berubah DAMAGED dengan peringatan bahwa alat tidak
 * boleh dipakai (statusBefore/After ikut ditulis di asset_events untuk itu).
 * Jatuh tempo berikutnya dihitung dari validUntil sertifikat bila diisi
 * (mengikuti tanggal pada sertifikat), atau dari performedAt + interval.
 */
export async function recordMaintenanceExecution(
  organizationId: string,
  actorUserId: string,
  input: RecordExecutionInput,
): Promise<{ eventId: string; recordId: string }> {
  return withOrg(organizationId, async (tx) => {
    await assertOrgWritable(organizationId, tx)
    const schedule = await tx.maintenanceSchedule.findFirst({
      where: { id: input.scheduleId, organizationId },
      select: { id: true, assetId: true, type: true, intervalMonths: true },
    })
    if (!schedule) throw new MaintenanceError("Jadwal tidak ditemukan.")
    const asset = await loadAssetOrThrow(tx, organizationId, schedule.assetId)
    if (asset.status === "DISPOSED") {
      throw new MaintenanceError("Aset yang sudah dihapuskan tidak dapat dicatat pelaksanaannya.")
    }

    const isFail = input.result === "FAIL"
    const eventType = schedule.type === "CALIBRATION" ? "CALIBRATION" : "MAINTENANCE"

    const event = await tx.assetEvent.create({
      data: {
        organizationId,
        assetId: schedule.assetId,
        type: eventType,
        title: EVENT_TITLES[schedule.type] ?? "Pemeliharaan dilaksanakan",
        notes: input.description,
        occurredAt: input.performedAt,
        recordedBy: actorUserId,
        locationId: asset.locationId,
        statusBefore: isFail ? asset.status : null,
        statusAfter: isFail ? "DAMAGED" : null,
        metadata: { result: input.result },
      },
      select: { id: true },
    })

    const record = await tx.maintenanceRecord.create({
      data: {
        organizationId,
        assetId: schedule.assetId,
        scheduleId: schedule.id,
        type: schedule.type,
        performedAt: input.performedAt,
        performedByVendorId: input.performedBy === "VENDOR" ? input.performedByVendorId : null,
        performedByInternal: input.performedBy === "INTERNAL" ? input.performedByInternal : null,
        result: input.result,
        validUntil: input.validUntil,
        certificateNumber: input.certificateNumber,
        certificateObjectKey: input.certificateObjectKey,
        cost: input.cost,
        partsReplaced: input.partsReplaced,
        description: input.description,
        eventId: event.id,
        createdBy: actorUserId,
      },
      select: { id: true },
    })

    const nextDueAt = input.validUntil
      ? input.validUntil
      : (() => {
          const d = new Date(input.performedAt)
          d.setMonth(d.getMonth() + schedule.intervalMonths)
          return d
        })()

    await tx.maintenanceSchedule.update({
      where: { id: schedule.id },
      data: { lastPerformedAt: input.performedAt, nextDueAt },
    })

    if (isFail) {
      await tx.asset.update({ where: { id: schedule.assetId }, data: { status: "DAMAGED" } })
    }

    return { eventId: event.id, recordId: record.id }
  })
}

export async function requestCertificateUpload(
  organizationId: string,
  input: { assetId: string; scheduleId: string; contentType: string; sizeBytes: number },
): Promise<{ uploadUrl: string; objectKey: string }> {
  return withOrg(organizationId, async (tx) => {
    await assertOrgWritable(organizationId, tx)
    await loadAssetOrThrow(tx, organizationId, input.assetId)
    await assertStorageQuota(organizationId, BigInt(input.sizeBytes), tx)

    const ext =
      input.contentType === "application/pdf"
        ? "pdf"
        : input.contentType === "image/png"
          ? "png"
          : "jpg"
    const objectKey = objectKeyForCertificate({
      organizationId,
      assetId: input.assetId,
      scheduleId: input.scheduleId,
      ext,
    })
    const { url } = await presignUpload({ objectKey, contentType: input.contentType })
    return { uploadUrl: url, objectKey }
  })
}

export async function getCertificateDownloadUrl(
  organizationId: string,
  recordId: string,
): Promise<{ url: string }> {
  return withOrg(organizationId, async (tx) => {
    const record = await tx.maintenanceRecord.findFirst({
      where: { id: recordId, organizationId },
      select: { certificateObjectKey: true },
    })
    if (!record?.certificateObjectKey) throw new MaintenanceError("Sertifikat tidak ditemukan.")
    return presignDownload({ objectKey: record.certificateObjectKey })
  })
}

export type DueScheduleRow = {
  id: string
  assetId: string
  assetCode: string
  assetName: string
  categoryName: string | null
  locationName: string
  type: string
  nextDueAt: Date
  daysUntilDue: number
  bucket: "OVERDUE" | "DUE_7" | "DUE_30" | "DUE_90" | "LATER"
}

function bucketFor(days: number): DueScheduleRow["bucket"] {
  if (days < 0) return "OVERDUE"
  if (days <= 7) return "DUE_7"
  if (days <= 30) return "DUE_30"
  if (days <= 90) return "DUE_90"
  return "LATER"
}

/** FR-23: dashboard jatuh tempo, dikelompokkan dan dapat difilter per instalasi/kategori.
 * `departmentId`, bila diisi, menyaring aset yang ruangannya berada di bawah
 * instalasi tersebut — aset hanya pernah berada di ROOM, bukan langsung di
 * instalasi (DEPARTMENT), jadi filternya perlu resolve ruangan turunannya dulu.
 */
export async function listDueSchedules(
  organizationId: string,
  filter: { departmentId?: string; categoryId?: string } = {},
): Promise<DueScheduleRow[]> {
  return withOrg(organizationId, async (tx) => {
    const roomIds = filter.departmentId
      ? (
          await tx.location.findMany({
            where: { organizationId, parentId: filter.departmentId, type: "ROOM" },
            select: { id: true },
          })
        ).map((r) => r.id)
      : null

    const schedules = await tx.maintenanceSchedule.findMany({
      where: {
        organizationId,
        isActive: true,
        asset: {
          organizationId,
          status: { not: "DISPOSED" },
          ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
          ...(roomIds ? { locationId: { in: roomIds } } : {}),
        },
      },
      orderBy: { nextDueAt: "asc" },
      select: {
        id: true,
        type: true,
        nextDueAt: true,
        asset: {
          select: {
            id: true,
            assetCode: true,
            name: true,
            category: { select: { name: true } },
            location: { select: { name: true } },
          },
        },
      },
    })

    const now = Date.now()
    return schedules.map((s) => {
      const daysUntilDue = Math.floor((s.nextDueAt.getTime() - now) / 86_400_000)
      return {
        id: s.id,
        assetId: s.asset.id,
        assetCode: s.asset.assetCode,
        assetName: s.asset.name,
        categoryName: s.asset.category?.name ?? null,
        locationName: s.asset.location.name,
        type: s.type,
        nextDueAt: s.nextDueAt,
        daysUntilDue,
        bucket: bucketFor(daysUntilDue),
      }
    })
  })
}

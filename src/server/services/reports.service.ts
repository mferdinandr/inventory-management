import "server-only"
import { withOrg } from "@/server/db"

// FR-27 (docs/02-prd.md §H, v1.1): lima laporan terdaftar di PRD.

export type RoomInventoryRow = {
  assetCode: string
  name: string
  categoryName: string | null
  brand: string | null
  model: string | null
  serialNumber: string | null
  condition: string
  status: string
  acquisitionDate: Date | null
}

/** FR-27: daftar aset per ruangan — dasar berita acara inventaris ruangan. */
export async function getRoomInventoryReport(
  organizationId: string,
  roomId: string,
): Promise<RoomInventoryRow[]> {
  return withOrg(organizationId, (tx) =>
    tx.asset
      .findMany({
        where: { organizationId, locationId: roomId, status: { not: "DISPOSED" } },
        orderBy: { assetCode: "asc" },
        select: {
          assetCode: true,
          name: true,
          category: { select: { name: true } },
          brand: true,
          model: true,
          serialNumber: true,
          condition: true,
          status: true,
          acquisitionDate: true,
        },
      })
      .then((rows) =>
        rows.map((r) => ({
          assetCode: r.assetCode,
          name: r.name,
          categoryName: r.category?.name ?? null,
          brand: r.brand,
          model: r.model,
          serialNumber: r.serialNumber,
          condition: r.condition,
          status: r.status,
          acquisitionDate: r.acquisitionDate,
        })),
      ),
  )
}

export type LoanReportRow = {
  assetCode: string
  assetName: string
  borrowerLabel: string
  purpose: string
  borrowedAt: Date
  dueAt: Date | null
  returnedAt: Date | null
  conditionOut: string
  conditionIn: string | null
}

/** FR-27: rekap peminjaman dalam rentang tanggal (berdasarkan borrowed_at). */
export async function getLoanReport(
  organizationId: string,
  range: { from: Date; to: Date },
): Promise<LoanReportRow[]> {
  return withOrg(organizationId, (tx) =>
    tx.loan
      .findMany({
        where: { organizationId, borrowedAt: { gte: range.from, lte: range.to } },
        orderBy: { borrowedAt: "desc" },
        select: {
          asset: { select: { assetCode: true, name: true } },
          borrowerType: true,
          borrowerName: true,
          borrowerUser: { select: { name: true } },
          purpose: true,
          borrowedAt: true,
          dueAt: true,
          returnedAt: true,
          conditionOut: true,
          conditionIn: true,
        },
      })
      .then((rows) =>
        rows.map((r) => ({
          assetCode: r.asset.assetCode,
          assetName: r.asset.name,
          borrowerLabel:
            r.borrowerType === "INTERNAL_USER"
              ? (r.borrowerUser?.name ?? "—")
              : (r.borrowerName ?? "—"),
          purpose: r.purpose,
          borrowedAt: r.borrowedAt,
          dueAt: r.dueAt,
          returnedAt: r.returnedAt,
          conditionOut: r.conditionOut,
          conditionIn: r.conditionIn,
        })),
      ),
  )
}

export type CalibrationReportRow = {
  assetCode: string
  assetName: string
  performedAt: Date
  performedBy: string
  result: string
  validUntil: Date | null
  certificateNumber: string | null
}

/** FR-27: rekap kalibrasi dan kepatuhannya (hasil tiap pelaksanaan). */
export async function getCalibrationReport(
  organizationId: string,
  range: { from: Date; to: Date },
): Promise<CalibrationReportRow[]> {
  return withOrg(organizationId, (tx) =>
    tx.maintenanceRecord
      .findMany({
        where: {
          organizationId,
          type: "CALIBRATION",
          performedAt: { gte: range.from, lte: range.to },
        },
        orderBy: { performedAt: "desc" },
        select: {
          asset: { select: { assetCode: true, name: true } },
          performedAt: true,
          performedByInternal: true,
          vendor: { select: { name: true } },
          result: true,
          validUntil: true,
          certificateNumber: true,
        },
      })
      .then((rows) =>
        rows.map((r) => ({
          assetCode: r.asset.assetCode,
          assetName: r.asset.name,
          performedAt: r.performedAt,
          performedBy: r.vendor?.name ?? r.performedByInternal ?? "—",
          result: r.result ?? "—",
          validUntil: r.validUntil,
          certificateNumber: r.certificateNumber,
        })),
      ),
  )
}

export type LostDisposedRow = {
  assetCode: string
  name: string
  status: string
  disposalReason: string | null
  disposedAt: Date | null
}

/** FR-27: rekap aset hilang dan dihapuskan. */
export async function getLostDisposedReport(organizationId: string): Promise<LostDisposedRow[]> {
  return withOrg(organizationId, (tx) =>
    tx.asset.findMany({
      where: { organizationId, status: { in: ["LOST", "DISPOSED"] } },
      orderBy: { disposedAt: "desc" },
      select: {
        assetCode: true,
        name: true,
        status: true,
        disposalReason: true,
        disposedAt: true,
      },
    }),
  )
}

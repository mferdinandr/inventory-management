import { NextResponse } from "next/server"
import { hasPermission } from "@/lib/permissions"
import { buildCsv, buildXlsx, type Column, fileResponse } from "@/server/export"
import {
  getCalibrationReport,
  getLoanReport,
  getLostDisposedReport,
  getRoomInventoryReport,
} from "@/server/services/reports.service"
import { requireActiveOrg, requireUser } from "@/server/tenant"

// FR-27: format ekspor Excel (XLSX) dan CSV untuk kelima laporan.

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Tersedia",
  IN_USE: "Sedang dipakai",
  ON_LOAN: "Sedang dipinjam",
  UNDER_REPAIR: "Dalam perbaikan",
  AT_VENDOR: "Di vendor",
  DAMAGED: "Rusak",
  LOST: "Hilang",
  DISPOSED: "Dihapuskan",
}

function fmtDate(d: Date | null): string {
  return d ? new Date(d).toLocaleDateString("id-ID") : ""
}

export async function GET(request: Request): Promise<Response> {
  const user = await requireUser()
  if (!hasPermission(user.role, "report:view")) {
    return NextResponse.json(
      { error: "Anda tidak memiliki izin melihat laporan." },
      { status: 403 },
    )
  }
  const organizationId = await requireActiveOrg()
  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type")
  const format = searchParams.get("format") === "csv" ? "csv" : "xlsx"

  let sheetName: string
  let columns: Column[]
  let rows: Array<Record<string, unknown>>

  if (type === "room-inventory") {
    const roomId = searchParams.get("roomId")
    if (!roomId) return NextResponse.json({ error: "roomId wajib diisi." }, { status: 400 })
    const data = await getRoomInventoryReport(organizationId, roomId)
    sheetName = "Inventaris Ruangan"
    columns = [
      { header: "Kode Aset", key: "assetCode", width: 20 },
      { header: "Nama", key: "name", width: 30 },
      { header: "Kategori", key: "categoryName", width: 20 },
      { header: "Merek", key: "brand", width: 15 },
      { header: "Model", key: "model", width: 15 },
      { header: "Nomor Seri", key: "serialNumber", width: 20 },
      { header: "Kondisi", key: "condition", width: 15 },
      { header: "Status", key: "status", width: 15 },
      { header: "Tanggal Perolehan", key: "acquisitionDate", width: 18 },
    ]
    rows = data.map((r) => ({
      ...r,
      status: STATUS_LABELS[r.status] ?? r.status,
      acquisitionDate: fmtDate(r.acquisitionDate),
    }))
  } else if (type === "loans") {
    const from = new Date(searchParams.get("from") ?? "")
    const to = new Date(searchParams.get("to") ?? "")
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json({ error: "Rentang tanggal tidak valid." }, { status: 400 })
    }
    const data = await getLoanReport(organizationId, { from, to })
    sheetName = "Rekap Peminjaman"
    columns = [
      { header: "Kode Aset", key: "assetCode", width: 20 },
      { header: "Nama Aset", key: "assetName", width: 30 },
      { header: "Peminjam", key: "borrowerLabel", width: 20 },
      { header: "Keperluan", key: "purpose", width: 30 },
      { header: "Dipinjam", key: "borrowedAt", width: 18 },
      { header: "Jatuh Tempo", key: "dueAt", width: 18 },
      { header: "Dikembalikan", key: "returnedAt", width: 18 },
      { header: "Kondisi Pinjam", key: "conditionOut", width: 15 },
      { header: "Kondisi Kembali", key: "conditionIn", width: 15 },
    ]
    rows = data.map((r) => ({
      ...r,
      borrowedAt: fmtDate(r.borrowedAt),
      dueAt: fmtDate(r.dueAt),
      returnedAt: fmtDate(r.returnedAt),
    }))
  } else if (type === "calibration") {
    const from = new Date(searchParams.get("from") ?? "1970-01-01")
    const to = new Date(searchParams.get("to") ?? "2100-01-01")
    const data = await getCalibrationReport(organizationId, { from, to })
    sheetName = "Rekap Kalibrasi"
    columns = [
      { header: "Kode Aset", key: "assetCode", width: 20 },
      { header: "Nama Aset", key: "assetName", width: 30 },
      { header: "Tanggal Pelaksanaan", key: "performedAt", width: 18 },
      { header: "Pelaksana", key: "performedBy", width: 20 },
      { header: "Hasil", key: "result", width: 15 },
      { header: "Berlaku Sampai", key: "validUntil", width: 18 },
      { header: "Nomor Sertifikat", key: "certificateNumber", width: 20 },
    ]
    rows = data.map((r) => ({
      ...r,
      performedAt: fmtDate(r.performedAt),
      validUntil: fmtDate(r.validUntil),
    }))
  } else if (type === "lost-disposed") {
    const data = await getLostDisposedReport(organizationId)
    sheetName = "Aset Hilang dan Dihapuskan"
    columns = [
      { header: "Kode Aset", key: "assetCode", width: 20 },
      { header: "Nama", key: "name", width: 30 },
      { header: "Status", key: "status", width: 15 },
      { header: "Alasan Penghapusan", key: "disposalReason", width: 20 },
      { header: "Tanggal", key: "disposedAt", width: 18 },
    ]
    rows = data.map((r) => ({
      ...r,
      status: STATUS_LABELS[r.status] ?? r.status,
      disposedAt: fmtDate(r.disposedAt),
    }))
  } else {
    return NextResponse.json({ error: "Jenis laporan tidak dikenal." }, { status: 400 })
  }

  if (format === "csv") {
    return fileResponse(buildCsv(columns, rows), `${type}.csv`, "text/csv;charset=utf-8;")
  }
  const buffer = await buildXlsx(sheetName, columns, rows)
  return fileResponse(
    buffer,
    `${type}.xlsx`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  )
}

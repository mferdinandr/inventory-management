import "server-only"
import { parse as parseCsv } from "csv-parse/sync"
import ExcelJS from "exceljs"
import { type AssetFormInput, assetFormSchema } from "@/lib/validators/asset"
import type { ImportRawRow, ImportRowError } from "@/lib/validators/import"
import { IMPORT_TEMPLATE_COLUMNS } from "@/lib/validators/import"
import { withOrg } from "@/server/db"
import { buildXlsx } from "@/server/export"
import { type CreateAssetResult, createAssetInTx } from "@/server/services/asset.service"
import type { Prisma } from "../../../generated/prisma/client"

// FR-29 (docs/02-prd.md §H, v1.1): unggah Excel/CSV dengan templat →
// pratinjau dan validasi (baris bermasalah beserta nomor barisnya) →
// commit transaksional per batch → CREATED per aset → tautan cetak label.

export async function buildImportTemplate(): Promise<Buffer> {
  return buildXlsx(
    "Templat Impor Aset",
    IMPORT_TEMPLATE_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: 24 })),
    [],
  )
}

/** Mengurai berkas mentah menjadi baris {kolom: nilai}; belum tervalidasi. */
export async function parseImportFile(buffer: Buffer, mimeType: string): Promise<ImportRawRow[]> {
  if (mimeType === "text/csv" || mimeType === "application/vnd.ms-excel") {
    const records: string[][] = parseCsv(buffer, { skip_empty_lines: true })
    const [header, ...rows] = records
    if (!header) return []
    return rows.map((row) => Object.fromEntries(header.map((h, i) => [h, row[i] ?? ""])))
  }

  const workbook = new ExcelJS.Workbook()
  // Ketidakcocokan versi tipe @types/node vs Buffer yang dibundel exceljs,
  // bukan ketidakcocokan runtime — nilainya tetap Buffer Node.js biasa.
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0])
  const sheet = workbook.worksheets[0]
  if (!sheet) return []
  const header: string[] = []
  sheet.getRow(1).eachCell((cell, colNumber) => {
    header[colNumber - 1] = String(cell.value ?? "")
  })
  const rows: ImportRawRow[] = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const record: ImportRawRow = {}
    header.forEach((key, i) => {
      const cell = row.getCell(i + 1)
      const value = cell.value
      record[key] =
        value instanceof Date
          ? value.toISOString().slice(0, 10)
          : value === null || value === undefined
            ? ""
            : String(value)
    })
    rows.push(record)
  })
  return rows
}

function findColumn(row: ImportRawRow, key: string): string {
  const col = IMPORT_TEMPLATE_COLUMNS.find((c) => c.key === key)
  if (!col) return ""
  return (row[col.header] ?? "").trim()
}

export type ValidatedImportRow = { rowNumber: number; input: AssetFormInput; name: string }

export async function validateImportRows(
  organizationId: string,
  rawRows: ImportRawRow[],
): Promise<{ validRows: ValidatedImportRow[]; errors: ImportRowError[] }> {
  return withOrg(organizationId, async (tx) => {
    const validRows: ValidatedImportRow[] = []
    const errors: ImportRowError[] = []

    for (let i = 0; i < rawRows.length; i++) {
      const raw = rawRows[i]!
      const rowNumber = i + 2 // +1 untuk header, +1 karena 1-indexed

      const categoryName = findColumn(raw, "category")
      const roomName = findColumn(raw, "room")
      if (!categoryName) {
        errors.push({ row: rowNumber, message: "Kategori wajib diisi." })
        continue
      }
      if (!roomName) {
        errors.push({ row: rowNumber, message: "Ruangan wajib diisi." })
        continue
      }

      const category = await tx.category.findFirst({
        where: {
          organizationId,
          name: { equals: categoryName, mode: "insensitive" },
          isActive: true,
        },
        select: { id: true },
      })
      if (!category) {
        errors.push({ row: rowNumber, message: `Kategori "${categoryName}" tidak ditemukan.` })
        continue
      }

      const rooms = await tx.location.findMany({
        where: {
          organizationId,
          type: "ROOM",
          isActive: true,
          name: { equals: roomName, mode: "insensitive" },
        },
        select: { id: true },
      })
      if (rooms.length === 0) {
        errors.push({ row: rowNumber, message: `Ruangan "${roomName}" tidak ditemukan.` })
        continue
      }
      if (rooms.length > 1) {
        errors.push({
          row: rowNumber,
          message: `Nama ruangan "${roomName}" tidak unik — ada lebih dari satu ruangan dengan nama ini.`,
        })
        continue
      }

      const parsed = assetFormSchema.safeParse({
        name: findColumn(raw, "name"),
        categoryId: category.id,
        locationId: rooms[0]!.id,
        condition: findColumn(raw, "condition") || "GOOD",
        acquisitionDate: findColumn(raw, "acquisitionDate"),
        brand: findColumn(raw, "brand"),
        model: findColumn(raw, "model"),
        serialNumber: findColumn(raw, "serialNumber"),
        yearManufactured: findColumn(raw, "yearManufactured"),
        fundingSource: findColumn(raw, "fundingSource"),
        acquisitionCost: findColumn(raw, "acquisitionCost"),
        acquisitionDocumentNo: findColumn(raw, "acquisitionDocumentNo"),
        warrantyUntil: findColumn(raw, "warrantyUntil"),
        economicLifeYears: findColumn(raw, "economicLifeYears"),
        notes: findColumn(raw, "notes"),
        confirmDuplicateSerial: true, // FR-29: baris impor tidak melalui alur konfirmasi interaktif
      })
      if (!parsed.success) {
        errors.push({
          row: rowNumber,
          message: parsed.error.issues[0]?.message ?? "Data tidak valid.",
        })
        continue
      }

      validRows.push({ rowNumber, input: parsed.data, name: parsed.data.name })
    }

    return { validRows, errors }
  })
}

/** FR-29: satu batch = satu transaksi — semua baris berhasil, atau tidak sama sekali. */
export async function commitImportBatch(
  organizationId: string,
  actorUserId: string,
  rows: AssetFormInput[],
): Promise<CreateAssetResult[]> {
  return withOrg(organizationId, async (tx: Prisma.TransactionClient) => {
    const results: CreateAssetResult[] = []
    for (const input of rows) {
      results.push(await createAssetInTx(tx, organizationId, actorUserId, input))
    }
    return results
  })
}

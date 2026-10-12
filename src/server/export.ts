import "server-only"
import ExcelJS from "exceljs"

// FR-27/FR-29: format ekspor/impor yang dipakai bersama seluruh laporan dan
// templat impor massal — satu tempat untuk definisi kolom→XLSX/CSV.

export type Column = { header: string; key: string; width?: number }

export async function buildXlsx(
  sheetName: string,
  columns: Column[],
  rows: Array<Record<string, unknown>>,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(sheetName)
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 20 }))
  sheet.getRow(1).font = { bold: true }
  for (const row of rows) sheet.addRow(row)
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

function toCsvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value)
  return `"${s.replace(/"/g, '""')}"`
}

export function buildCsv(columns: Column[], rows: Array<Record<string, unknown>>): string {
  const header = columns.map((c) => toCsvCell(c.header)).join(",")
  const lines = rows.map((row) => columns.map((c) => toCsvCell(row[c.key])).join(","))
  return [header, ...lines].join("\r\n")
}

export function fileResponse(
  buffer: Buffer | string,
  filename: string,
  contentType: string,
): Response {
  const body = typeof buffer === "string" ? buffer : new Uint8Array(buffer)
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}

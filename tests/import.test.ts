import { PrismaPg } from "@prisma/adapter-pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { PrismaClient } from "../generated/prisma/client"
import { IMPORT_TEMPLATE_COLUMNS } from "../src/lib/validators/import"
import {
  buildImportTemplate,
  commitImportBatch,
  parseImportFile,
  validateImportRows,
} from "../src/server/services/import.service"

const setup = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL_PLATFORM ?? process.env.DATABASE_URL ?? "",
  }),
})

let orgId: string
let adminId: string
let roomName: string
let categoryName: string

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
    select: { name: true },
  })
  roomName = room.name
  const fur = await setup.category.findFirstOrThrow({
    where: { organizationId: orgId, code: "FUR" },
    select: { name: true },
  })
  categoryName = fur.name
})

afterAll(async () => {
  await setup.$disconnect()
})

function csvRow(overrides: Record<string, string> = {}): Record<string, string> {
  const base: Record<string, string> = {
    name: `Aset Impor ${Date.now()}-${Math.random().toString(36).slice(2)}`,
    category: categoryName,
    room: roomName,
    condition: "GOOD",
    acquisitionDate: "2026-02-01",
    brand: "",
    model: "",
    serialNumber: "",
    yearManufactured: "",
    fundingSource: "",
    acquisitionCost: "",
    acquisitionDocumentNo: "",
    warrantyUntil: "",
    economicLifeYears: "",
    notes: "",
  }
  return { ...base, ...overrides }
}

// IMPORT_TEMPLATE_COLUMNS memetakan key singkat (dipakai csvRow() di atas
// untuk keterbacaan) ke teks header asli — baris mentah yang sesungguhnya
// dikonsumsi validateImportRows() diindeks dengan teks header, persis
// seperti keluaran parseImportFile(), bukan dengan key singkat itu.
function toHeaderRow(row: Record<string, string>): Record<string, string> {
  return Object.fromEntries(IMPORT_TEMPLATE_COLUMNS.map((c) => [c.header, row[c.key] ?? ""]))
}

function toCsvBuffer(rows: Record<string, string>[]): Buffer {
  const headers = IMPORT_TEMPLATE_COLUMNS.map((c) => c.header)
  const keyByHeader = Object.fromEntries(IMPORT_TEMPLATE_COLUMNS.map((c) => [c.header, c.key]))
  const lines = [headers.join(",")]
  for (const row of rows) {
    lines.push(
      headers.map((h) => `"${(row[keyByHeader[h]!] ?? "").replace(/"/g, '""')}"`).join(","),
    )
  }
  return Buffer.from(lines.join("\n"), "utf-8")
}

describe("buildImportTemplate (FR-29)", () => {
  it("produces a non-empty XLSX buffer", async () => {
    const buffer = await buildImportTemplate()
    expect(buffer.length).toBeGreaterThan(0)
  })
})

describe("parseImportFile (FR-29)", () => {
  it("parses a CSV file into rows keyed by header", async () => {
    const buffer = toCsvBuffer([csvRow()])
    const rows = await parseImportFile(buffer, "text/csv")
    expect(rows).toHaveLength(1)
    expect(rows[0]?.[IMPORT_TEMPLATE_COLUMNS[0]!.header]).toBeTruthy()
  })
})

describe("validateImportRows (FR-29)", () => {
  it("accepts a well-formed row and resolves category/room names to ids", async () => {
    const rawRows = [csvRow()].map(toHeaderRow)
    const { validRows, errors } = await validateImportRows(orgId, rawRows)
    expect(errors).toHaveLength(0)
    expect(validRows).toHaveLength(1)
  })

  it("reports an unknown category with the correct row number", async () => {
    const rawRows = [csvRow(), csvRow({ category: "Kategori Tidak Ada Sama Sekali" })].map(
      toHeaderRow,
    )
    const { validRows, errors } = await validateImportRows(orgId, rawRows)
    expect(validRows).toHaveLength(1)
    expect(errors).toHaveLength(1)
    expect(errors[0]?.row).toBe(3) // baris 1 = header, baris data kedua = nomor 3
    expect(errors[0]?.message).toContain("Kategori")
  })

  it("reports an unknown room", async () => {
    const rawRows = [csvRow({ room: "Ruang Yang Tidak Ada" })].map(toHeaderRow)
    const { errors } = await validateImportRows(orgId, rawRows)
    expect(errors[0]?.message).toContain("Ruangan")
  })

  it("reports a schema validation failure (missing name) with its row number", async () => {
    const rawRows = [csvRow({ name: "" })].map(toHeaderRow)
    const { validRows, errors } = await validateImportRows(orgId, rawRows)
    expect(validRows).toHaveLength(0)
    expect(errors[0]?.row).toBe(2)
  })
})

describe("commitImportBatch (FR-29)", () => {
  it("creates one asset with a CREATED event per valid row, all in one transaction", async () => {
    const rawRows = [csvRow(), csvRow()].map(toHeaderRow)
    const { validRows, errors } = await validateImportRows(orgId, rawRows)
    expect(errors).toHaveLength(0)

    const results = await commitImportBatch(
      orgId,
      adminId,
      validRows.map((r) => r.input),
    )
    expect(results).toHaveLength(2)

    for (const r of results) {
      const event = await setup.assetEvent.findFirst({ where: { assetId: r.id, type: "CREATED" } })
      expect(event).not.toBeNull()
    }
  })
})

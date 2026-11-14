import ExcelJS from "exceljs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { parseWorkbook } from "@/server/import/xlsx";
import { importExcel } from "@/server/import/xlsx-run";
import { buildImportTemplate } from "@/server/import/xlsx-template";
import { createUser } from "@/server/services/user.service";
import { resetDatabase } from "./helpers/reset-db";

type Sheets = Record<string, (string | number | null)[][]>;

async function workbook(sheets: Sheets): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(sheets)) wb.addWorksheet(name).addRows(rows);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const STD = [
  "Column 1",
  "NAMA ITEM",
  "MEREK",
  "KONDISI",
  "JUMLAH",
  "Status",
  "Catatan",
  "TGL",
  "TGL",
];

describe("parseWorkbook", () => {
  it("turns each set into one item and each row into a content row", async () => {
    const r = await parseWorkbook(
      await workbook({
        MINOR: [
          STD,
          ["MINOR 1", "DOEK KLEM", "AESCULAP", "BAIK", 6, "Tersedia", null, "15/11/2025"],
          ["MINOR 1", "PEAN", "AESCULAP", "RUSAK", 5, "Tersedia", "patah"],
          ["MINOR 2", "NALFUDER", "AESCULAP", "BAIK", 3, "Tersedia"],
        ],
      }),
    );
    expect(r.issues).toEqual([]);
    expect(r.candidates.map((c) => c.input.name)).toEqual(["MINOR 1", "MINOR 2"]);
    const first = r.candidates[0]?.input;
    expect(first?.needsSterilization).toBe(true);
    expect(first?.contents?.map((c) => [c.name, c.quantity, c.damagedQuantity])).toEqual([
      ["DOEK KLEM", 6, 0],
      ["PEAN", 5, 5],
    ]);
    expect(first?.contents?.[1]?.note).toBe("patah");
  });

  it("finds columns by header: extra NO column, swapped THT order, blank JUMLAH", async () => {
    const r = await parseWorkbook(
      await workbook({
        UROLOGI: [
          ["NO", "ID item", "NAMA ITEM", "MEREK", "KONDISI", "JUMLAH", "Status", "Catatan"],
          [1, "ENDO UROLOGI", "MONITOR", "STORZ", "BAIK", 2, "Tersedia", null],
        ],
        THT: [
          ["ID item", "NAMA ITEM", "MEREK", "KONDISI", "Status", "JUMLAH", "Status"],
          ["CWL", "Allis", "LOWTON", "BAIK", "Tersedia", null, null],
        ],
      }),
    );
    expect(r.issues).toEqual([]);
    const [uro, tht] = r.candidates.map((c) => c.input.contents?.[0]);
    expect(uro?.quantity).toBe(2);
    expect(tht?.quantity).toBe(1);
  });

  it("skips sheets without a NAMA ITEM header", async () => {
    const r = await parseWorkbook(
      await workbook({
        "AESCULAP NEW": [["1", "SET MAYOR", "Aesculap"]],
        MINOR: [STD, ["MINOR 1", "PEAN", "X", "BAIK", 1]],
      }),
    );
    expect(r.skippedSheets.map((s) => s.sheet)).toEqual(["AESCULAP NEW"]);
    expect(r.candidates).toHaveLength(1);
  });

  it("reports every problem with sheet and row", async () => {
    const r = await parseWorkbook(
      await workbook({
        MINOR: [
          STD,
          ["MINOR 1", "PEAN", "X", "BAIK", "banyak"],
          ["MINOR 2", "KLEM", "X", "BAIK", 1],
          ["MINOR 2", "klem", "X", "BAIK", 1],
          [null, "TANPA SET", "X", "BAIK", 1],
        ],
      }),
    );
    expect(r.candidates).toHaveLength(0);
    expect(r.issues.map((i) => [i.sheet, i.row])).toEqual([
      ["MINOR", 2],
      ["MINOR", 3], // duplicate name is reported on the set's first row
      ["MINOR", 5],
    ]);
  });

  it("reads the downloadable template as an empty, valid list", async () => {
    const r = await parseWorkbook(await buildImportTemplate());
    expect(r.issues).toEqual([]);
    expect(r.candidates).toEqual([]);
    expect(r.skippedSheets.map((s) => s.sheet)).toEqual(["PETUNJUK"]);
  });

  it("rejects a file that is not xlsx", async () => {
    await expect(parseWorkbook(Buffer.from("a,b,c"))).rejects.toThrow("bukan Excel");
  });
});

describe("importExcel", () => {
  let actor: { id: string; name: string; role: "OPERASI" };
  beforeEach(async () => {
    await resetDatabase();
    const u = await createUser({
      username: "petugas",
      name: "Petugas OK",
      role: "OPERASI",
      password: "password-123",
    });
    actor = { id: u.id, name: u.name, role: "OPERASI" };
  });
  afterAll(resetDatabase);

  const file = () =>
    workbook({
      MINOR: [
        STD,
        ["MINOR 1", "DOEK KLEM", "AESCULAP", "BAIK", 6],
        ["MINOR 1", "PEAN", "AESCULAP", "BAIK", 5],
      ],
    });

  it("writes nothing on a dry run", async () => {
    const r = await importExcel(actor, await file(), true);
    expect([r.created, r.contentsCreated]).toEqual([1, 2]);
    expect(r.preview.map((p) => [p.name, p.contents.length])).toEqual([["MINOR 1", 2]]);
    expect(await db.item.count()).toBe(0);
  });

  it("creates items with a REGISTER log, then skips them on re-upload", async () => {
    const r = await importExcel(actor, await file(), false);
    expect(r.blocked).toBe(false);
    const item = await db.item.findFirstOrThrow({
      include: { contents: true, logs: true },
    });
    expect(item.name).toBe("MINOR 1");
    expect(item.contents).toHaveLength(2);
    expect(item.logs.map((l) => [l.action, l.actorName])).toEqual([["REGISTER", "Petugas OK"]]);

    const again = await importExcel(actor, await file(), false);
    expect(again.created).toBe(0);
    expect(again.skippedDuplicate).toHaveLength(1);
    expect(await db.item.count()).toBe(1);
  });

  it("writes nothing when the file has errors", async () => {
    const bad = await workbook({ MINOR: [STD, ["MINOR 1", "PEAN", "X", "BAIK", "x"]] });
    const r = await importExcel(actor, bad, false);
    expect(r.blocked).toBe(true);
    expect(await db.item.count()).toBe(0);
  });
});

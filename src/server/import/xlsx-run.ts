import { db } from "@/server/db";
import { type Actor, registerItem } from "@/server/services/item.service";
import { parseWorkbook, type SheetIssue } from "./xlsx";

/** What will be (or was) created, shown in the preview. */
export type PreviewSet = {
  sheet: string;
  row: number;
  name: string;
  contents: {
    name: string;
    brand: string | null;
    quantity: number;
    damagedQuantity: number;
    note: string | null;
  }[];
};

export type ExcelReport = {
  dryRun: boolean;
  /** True when nothing was written because the file has errors. */
  blocked: boolean;
  sets: number;
  contentRows: number;
  created: number;
  contentsCreated: number;
  /** Already in the database (same name, no room), or repeated in the file. */
  skippedDuplicate: { sheet: string; row: number; name: string; reason: string }[];
  skippedSheets: { sheet: string; reason: string }[];
  /** Sets that are created, in file order. */
  preview: PreviewSet[];
  issues: SheetIssue[];
};

const key = (name: string) => name.trim().toLowerCase();

/**
 * Imports an Excel inventory list as the signed-in user. Any error blocks the whole file so it
 * can be fixed and uploaded again; sets that already exist (same name, no room) are skipped.
 */
export async function importExcel(
  actor: Actor,
  data: ArrayBuffer | Buffer,
  dryRun: boolean,
): Promise<ExcelReport> {
  const parsed = await parseWorkbook(data);
  const report: ExcelReport = {
    dryRun,
    blocked: parsed.issues.length > 0,
    sets: parsed.candidates.length,
    contentRows: parsed.contentRows,
    created: 0,
    contentsCreated: 0,
    skippedDuplicate: [],
    skippedSheets: parsed.skippedSheets,
    preview: [],
    issues: parsed.issues,
  };
  if (report.blocked) return report;

  const existing = new Set(
    (await db.item.findMany({ where: { room: null }, select: { name: true } })).map((i) =>
      key(i.name),
    ),
  );
  for (const c of parsed.candidates) {
    const k = key(c.input.name);
    const skip = (reason: string) =>
      report.skippedDuplicate.push({ sheet: c.sheet, row: c.row, name: c.input.name, reason });
    if (existing.has(k)) {
      skip("sudah ada di daftar barang atau muncul lebih dari sekali di berkas");
      continue;
    }
    existing.add(k);
    if (!dryRun) {
      try {
        await registerItem(actor, c.input);
      } catch (e) {
        report.blocked = true;
        report.issues.push({
          sheet: c.sheet,
          row: c.row,
          message: `Gagal disimpan: ${e instanceof Error ? e.message : String(e)}`,
        });
        continue;
      }
    }
    report.created++;
    report.preview.push({
      sheet: c.sheet,
      row: c.row,
      name: c.input.name,
      contents: (c.input.contents ?? []).map((x) => ({
        name: x.name,
        brand: x.brand || null,
        quantity: x.quantity,
        damagedQuantity: x.damagedQuantity ?? 0,
        note: x.note || null,
      })),
    });
    report.contentsCreated += c.input.contents?.length ?? 0;
  }
  return report;
}

import ExcelJS from "exceljs";
import { type RegisterItemInput, registerItemSchema } from "@/lib/validators/item";

/** One problem, located by sheet and spreadsheet row (as Excel shows it). */
export type SheetIssue = { sheet: string; row: number; message: string };

export type ExcelCandidate = {
  sheet: string;
  /** First spreadsheet row of the set. */
  row: number;
  input: RegisterItemInput;
};

export type ExcelParse = {
  candidates: ExcelCandidate[];
  issues: SheetIssue[];
  /** Sheets that do not look like an item list (no NAMA ITEM header); not an error. */
  skippedSheets: { sheet: string; reason: string }[];
  /** Data rows read (rows that became contents). */
  contentRows: number;
};

/** Header text (lower case) -> field. "Status" and the verification dates are not imported. */
const GROUP_HEADERS = new Set(["column 1", "id item"]);
const HEADER_ROWS_SCANNED = 5;

type Columns = {
  group: number;
  name: number;
  brand?: number;
  condition?: number;
  quantity?: number;
  note?: number;
};

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("result" in v) return v.result === undefined || v.result === null ? "" : String(v.result);
    if ("text" in v) return String(v.text);
  }
  return String(v);
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** Finds the header row and maps the columns we use; null when the sheet is not an item list. */
function findColumns(
  sheet: ExcelJS.Worksheet,
): { headerRow: number; cols: Columns } | { reason: string } {
  for (let r = 1; r <= Math.min(HEADER_ROWS_SCANNED, sheet.rowCount); r++) {
    const byHeader = new Map<string, number>();
    sheet.getRow(r).eachCell({ includeEmpty: false }, (cell, col) => {
      const h = clean(cellText(cell)).toLowerCase();
      // The first column with a given header wins (THT repeats "Status").
      if (h && !byHeader.has(h)) byHeader.set(h, col);
    });
    const name = byHeader.get("nama item");
    if (name === undefined) continue;
    const group = [...byHeader].find(([h]) => GROUP_HEADERS.has(h))?.[1];
    if (group === undefined) {
      return { reason: 'kolom "ID item" (atau "Column 1") tidak ada di header' };
    }
    return {
      headerRow: r,
      cols: {
        group,
        name,
        brand: byHeader.get("merek"),
        condition: byHeader.get("kondisi"),
        quantity: byHeader.get("jumlah"),
        note: byHeader.get("catatan"),
      },
    };
  }
  return { reason: 'tidak ada kolom "NAMA ITEM" di header' };
}

/**
 * Reads an `.xlsx` inventory list: per sheet, every distinct "ID item" value (e.g. `MINOR 1`)
 * becomes one sterilizable item and each of its rows becomes one content row
 * (docs/14-impor-csv.md section 3). Everything wrong is collected, not just the first problem.
 */
export async function parseWorkbook(data: ArrayBuffer | Buffer): Promise<ExcelParse> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(data as ArrayBuffer);
  } catch {
    throw new Error("Berkas bukan Excel (.xlsx) yang valid");
  }

  const out: ExcelParse = { candidates: [], issues: [], skippedSheets: [], contentRows: 0 };

  for (const sheet of workbook.worksheets) {
    const found = findColumns(sheet);
    if ("reason" in found) {
      out.skippedSheets.push({ sheet: sheet.name, reason: found.reason });
      continue;
    }
    const { headerRow, cols } = found;
    const add = (row: number, message: string) =>
      out.issues.push({ sheet: sheet.name, row, message });

    type Group = { row: number; contents: Record<string, unknown>[]; rows: number[] };
    const groups = new Map<string, Group>();
    const blockedGroups = new Set<string>();

    for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const text = (col?: number) => (col ? clean(cellText(row.getCell(col))) : "");
      const group = text(cols.group);
      const name = text(cols.name);
      if (group === "" && name === "") continue; // blank or spacer row
      if (group === "") {
        add(r, `ID item kosong untuk "${name}"`);
        continue;
      }
      if (name === "") {
        add(r, `NAMA ITEM kosong (${group})`);
        blockedGroups.add(group);
        continue;
      }

      let quantity: number | undefined;
      const rawQuantity = text(cols.quantity);
      if (rawQuantity !== "") {
        if (/^\d+([.,]0+)?$/.test(rawQuantity)) quantity = Number(rawQuantity.replace(",", "."));
        else {
          add(r, `JUMLAH: "${rawQuantity}" bukan bilangan bulat`);
          blockedGroups.add(group);
          continue;
        }
      }
      // A row without a count is one piece; KONDISI "RUSAK" means all of them are damaged.
      const total = quantity ?? 1;
      const damaged = /rusak/i.test(text(cols.condition)) ? total : 0;

      const g = groups.get(group) ?? { row: r, contents: [], rows: [] };
      g.contents.push({
        name,
        brand: text(cols.brand),
        quantity: total,
        damagedQuantity: damaged,
        note: text(cols.note),
      });
      g.rows.push(r);
      groups.set(group, g);
      out.contentRows++;
    }

    for (const [group, g] of groups) {
      if (blockedGroups.has(group)) continue;
      const input = {
        name: group,
        needsSterilization: true,
        quantity: 1,
        damagedQuantity: 0,
        contents: g.contents,
      };
      const parsed = registerItemSchema.safeParse(input);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const [head, index] = issue.path;
          const row = head === "contents" && typeof index === "number" ? g.rows[index] : g.row;
          add(row ?? g.row, `${group}: ${issue.message}`);
        }
        continue;
      }
      out.candidates.push({ sheet: sheet.name, row: g.row, input: input as RegisterItemInput });
    }
  }

  out.issues.sort((a, b) => (a.sheet === b.sheet ? a.row - b.row : 0));
  return out;
}

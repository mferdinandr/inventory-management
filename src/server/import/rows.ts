import { type RegisterItemInput, registerItemSchema } from "@/lib/validators/item";
import { type CsvRecord, readRecords } from "./csv";

export type ImportFile = "items" | "contents";

/** One problem, located by file and spreadsheet row (the header is row 1). */
export type ImportIssue = { file: ImportFile; row: number; message: string };

export type Candidate = {
  ref: string;
  /** Row in items.csv. */
  row: number;
  input: RegisterItemInput;
  /** Rows in contents.csv that belong to this item, in file order. */
  contentRows: number[];
};

export const ITEM_COLUMNS = [
  "ref",
  "name",
  "needs_sterilization",
  "room",
  "description",
  "quantity",
  "damaged_quantity",
  "brand",
  "model",
  "serial_number",
  "purchase_date",
  "purchase_price",
  "supplier",
  "funding_source",
  "warranty_until",
] as const;
export const CONTENT_COLUMNS = ["ref", "name", "brand", "quantity", "damaged_quantity", "note"];

const ITEM_REQUIRED = ["ref", "name", "needs_sterilization"];
const CONTENT_REQUIRED = ["ref", "name"];

/** Schema field name -> CSV column name, so messages point at what the user has to edit. */
const COLUMN_OF: Record<string, string> = {
  name: "name",
  needsSterilization: "needs_sterilization",
  quantity: "quantity",
  damagedQuantity: "damaged_quantity",
  room: "room",
  description: "description",
  brand: "brand",
  model: "model",
  serialNumber: "serial_number",
  purchaseDate: "purchase_date",
  purchasePrice: "purchase_price",
  supplier: "supplier",
  fundingSource: "funding_source",
  warrantyUntil: "warranty_until",
  note: "note",
};

type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };
const ok = <T>(value: T): Parsed<T> => ({ ok: true, value });
const fail = (message: string): Parsed<never> => ({ ok: false, message });

/** Empty means "not given", so the schema default (1 / 0) applies. */
function parseCount(column: string, raw: string): Parsed<number | undefined> {
  if (raw === "") return ok(undefined);
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return fail(`${column}: "${raw}" bukan angka`);
  return ok(Number(raw)); // negatives and fractions are rejected by the shared schema
}

const TRUE = new Set(["ya", "true", "1", "y", "iya"]);
const FALSE = new Set(["tidak", "false", "0", "n", "t"]);

function parseBool(column: string, raw: string): Parsed<boolean> {
  const v = raw.toLowerCase();
  if (TRUE.has(v)) return ok(true);
  if (FALSE.has(v)) return ok(false);
  return fail(`${column}: isi dengan ya/tidak (atau true/false, 1/0), bukan "${raw}"`);
}

/** `YYYY-MM-DD` or `DD/MM/YYYY`; returns `YYYY-MM-DD` (or "" when empty). */
export function parseDate(column: string, raw: string): Parsed<string> {
  if (raw === "") return ok("");
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  const iso = dmy
    ? `${dmy[3]}-${dmy[2]?.padStart(2, "0")}-${dmy[1]?.padStart(2, "0")}`
    : /^\d{4}-\d{2}-\d{2}$/.test(raw)
      ? raw
      : null;
  if (!iso || Number.isNaN(new Date(`${iso}T00:00:00Z`).getTime())) {
    return fail(`${column}: tanggal "${raw}" tidak valid (pakai YYYY-MM-DD atau DD/MM/YYYY)`);
  }
  // Date() accepts 2026-02-31 in some engines' leniency; make sure the day survived.
  if (new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) !== iso) {
    return fail(`${column}: tanggal "${raw}" tidak ada di kalender`);
  }
  return ok(iso);
}

/** "Rp 1.500.000", "1,500,000" and "1500000" all become 1500000. */
export function parsePrice(column: string, raw: string): Parsed<number | undefined> {
  if (raw === "") return ok(undefined);
  const digits = raw.replace(/rp\.?/i, "").replace(/[\s.,]/g, "");
  if (!/^\d+$/.test(digits)) return fail(`${column}: "${raw}" bukan harga yang valid`);
  return ok(Number(digits));
}

type Draft = { ref: string; row: number; input: Record<string, unknown>; ok: boolean };

function missingColumns(header: string[], required: string[]) {
  return required.filter((c) => !header.includes(c));
}

/**
 * Reads both files into one validated `RegisterItemInput` per item. Everything wrong is
 * collected, not just the first problem. An item with any problem (its own or in one of its
 * content rows) is left out of `candidates`.
 */
export function buildCandidates(itemsText: string, contentsText: string) {
  const issues: ImportIssue[] = [];
  const add = (file: ImportFile, row: number, message: string) =>
    issues.push({ file, row, message });

  let items: { header: string[]; records: CsvRecord[] };
  let contents: { header: string[]; records: CsvRecord[] };
  try {
    items = readRecords(itemsText);
  } catch (e) {
    add("items", 1, e instanceof Error ? e.message : String(e));
    items = { header: [], records: [] };
  }
  try {
    contents = readRecords(contentsText);
  } catch (e) {
    add("contents", 1, e instanceof Error ? e.message : String(e));
    contents = { header: [], records: [] };
  }

  const itemsHeaderBad = missingColumns(items.header, ITEM_REQUIRED);
  if (itemsHeaderBad.length > 0 && !issues.some((i) => i.file === "items")) {
    add("items", 1, `Kolom wajib tidak ada di header: ${itemsHeaderBad.join(", ")}`);
  }
  const contentsHeaderBad = missingColumns(contents.header, CONTENT_REQUIRED);
  if (contentsHeaderBad.length > 0 && contents.header.length > 0) {
    add("contents", 1, `Kolom wajib tidak ada di header: ${contentsHeaderBad.join(", ")}`);
  }
  for (const [file, h, known] of [
    ["items", items.header, ITEM_COLUMNS as readonly string[]],
    ["contents", contents.header, CONTENT_COLUMNS],
  ] as const) {
    const unknown = h.filter((c) => c !== "" && !known.includes(c));
    if (unknown.length > 0) add(file, 1, `Kolom tidak dikenal: ${unknown.join(", ")}`);
  }
  // A wrong header means the whole file is misread; nothing below would be meaningful.
  if (issues.length > 0) {
    return { candidates: [] as Candidate[], issues, itemRows: 0, contentRows: 0, invalidItems: 0 };
  }

  // --- items ---------------------------------------------------------------------------
  const drafts = new Map<string, Draft>();
  for (const { row, values: v } of items.records) {
    const rowIssues = (msg: string) => add("items", row, msg);
    let valid = true;
    const bad = (msg: string) => {
      valid = false;
      rowIssues(msg);
    };

    const ref = v.ref ?? "";
    if (ref === "") bad("ref wajib diisi");
    else if (drafts.has(ref))
      bad(`ref "${ref}" ganda (sudah dipakai di baris ${drafts.get(ref)?.row})`);

    const needs = parseBool("needs_sterilization", v.needs_sterilization ?? "");
    const quantity = parseCount("quantity", v.quantity ?? "");
    const damaged = parseCount("damaged_quantity", v.damaged_quantity ?? "");
    const date = parseDate("purchase_date", v.purchase_date ?? "");
    const warranty = parseDate("warranty_until", v.warranty_until ?? "");
    const price = parsePrice("purchase_price", v.purchase_price ?? "");
    for (const p of [needs, quantity, damaged, date, warranty, price]) {
      if (!p.ok) bad(p.message);
    }

    const input: Record<string, unknown> = {
      name: v.name ?? "",
      needsSterilization: needs.ok ? needs.value : undefined,
      quantity: quantity.ok ? quantity.value : undefined,
      damagedQuantity: damaged.ok ? damaged.value : undefined,
      room: v.room,
      description: v.description,
      brand: v.brand,
      model: v.model,
      serialNumber: v.serial_number,
      purchaseDate: date.ok ? date.value : undefined,
      purchasePrice: price.ok ? price.value : undefined,
      supplier: v.supplier,
      fundingSource: v.funding_source,
      warrantyUntil: warranty.ok ? warranty.value : undefined,
      contents: [],
    };
    if (ref !== "" && !drafts.has(ref)) drafts.set(ref, { ref, row, input, ok: valid });
  }

  // --- contents ------------------------------------------------------------------------
  const contentRowsByRef = new Map<string, number[]>();
  for (const { row, values: v } of contents.records) {
    const ref = v.ref ?? "";
    const draft = drafts.get(ref);
    if (ref === "") {
      add("contents", row, "ref wajib diisi");
      continue;
    }
    if (!draft) {
      add("contents", row, `ref "${ref}" tidak ditemukan di items.csv`);
      continue;
    }
    const quantity = parseCount("quantity", v.quantity ?? "");
    const damaged = parseCount("damaged_quantity", v.damaged_quantity ?? "");
    let valid = true;
    for (const p of [quantity, damaged]) {
      if (!p.ok) {
        valid = false;
        add("contents", row, p.message);
      }
    }
    if (!valid) draft.ok = false;
    const list = draft.input.contents as Record<string, unknown>[];
    list.push({
      name: v.name ?? "",
      brand: v.brand,
      // A content row without a count is one piece.
      quantity: quantity.ok ? (quantity.value ?? 1) : undefined,
      damagedQuantity: damaged.ok ? damaged.value : undefined,
      note: v.note,
    });
    contentRowsByRef.set(ref, [...(contentRowsByRef.get(ref) ?? []), row]);
  }

  // --- the shared schema decides the rest ----------------------------------------------
  const candidates: Candidate[] = [];
  for (const draft of drafts.values()) {
    const rows = contentRowsByRef.get(draft.ref) ?? [];
    const parsed = registerItemSchema.safeParse(draft.input);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const [head, index, field] = issue.path;
        const contentRow =
          head === "contents" && typeof index === "number" ? rows[index] : undefined;
        const key = String(contentRow !== undefined ? field : head);
        const column = COLUMN_OF[key];
        // Type errors on fields already reported while converting would be noise.
        if (!draft.ok && issue.code === "invalid_type") continue;
        const message =
          column && !issue.message.startsWith(column)
            ? `${column}: ${issue.message}`
            : issue.message;
        if (contentRow !== undefined) add("contents", contentRow, message);
        else add("items", draft.row, message);
      }
      continue;
    }
    if (!draft.ok) continue;
    candidates.push({
      ref: draft.ref,
      row: draft.row,
      input: draft.input as RegisterItemInput,
      contentRows: rows,
    });
  }

  issues.sort((a, b) => (a.file === b.file ? a.row - b.row : a.file === "items" ? -1 : 1));
  return {
    candidates,
    issues,
    itemRows: items.records.length,
    contentRows: contents.records.length,
    invalidItems: drafts.size - candidates.length,
  };
}

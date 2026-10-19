import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { type Actor, registerItem } from "@/server/services/item.service";
import { buildCandidates, type ImportIssue } from "./rows";

/** Written into `item_logs.actor_name` for every imported item. */
export const IMPORT_ACTOR_NAME = "Impor CSV";

export type ImportOptions = {
  itemsText: string;
  contentsText: string;
  /** Username recorded as `user_id` on the REGISTER logs. */
  username: string;
  dryRun?: boolean;
  /** Import the valid rows even when others have errors. */
  skipInvalid?: boolean;
};

export type MapEntry = {
  ref: string;
  code: string;
  status: "dibuat" | "sudah ada" | "akan dibuat";
};

export type ImportReport = {
  dryRun: boolean;
  /** True when nothing was written because of errors (and --skip-invalid was not given). */
  blocked: boolean;
  itemRows: number;
  contentRows: number;
  created: number;
  contentsCreated: number;
  /** Already in the database (same name and room), or repeated inside the file. */
  skippedDuplicate: { ref: string; row: number; reason: string }[];
  /** Rows with errors that were left out. */
  skippedInvalid: number;
  issues: ImportIssue[];
  warnings: string[];
  map: MapEntry[];
};

const key = (name: string, room?: string | null) =>
  `${name.trim().toLowerCase()}\u0000${(room ?? "").trim().toLowerCase()}`;

/** Validates both files, then writes one transaction per item. See docs/14-impor-csv.md. */
export async function runImport(opts: ImportOptions): Promise<ImportReport> {
  const user = await db.user.findUnique({ where: { username: opts.username } });
  if (!user?.isActive) {
    throw new AppError("NOT_FOUND", `Pengguna "${opts.username}" tidak ditemukan atau nonaktif`);
  }
  const actor: Actor = { id: user.id, name: IMPORT_ACTOR_NAME, role: "SUPERADMIN" };

  const built = buildCandidates(opts.itemsText, opts.contentsText);
  const report: ImportReport = {
    dryRun: opts.dryRun ?? false,
    blocked: false,
    itemRows: built.itemRows,
    contentRows: built.contentRows,
    created: 0,
    contentsCreated: 0,
    skippedDuplicate: [],
    skippedInvalid: built.itemRows - built.candidates.length,
    issues: built.issues,
    warnings: [],
    map: [],
  };

  if (built.issues.length > 0 && !opts.skipInvalid) {
    report.blocked = true;
    report.skippedInvalid = 0;
    return report;
  }

  // Idempotency: (name, room) that already exists is never imported again.
  const existing = new Map(
    (await db.item.findMany({ select: { name: true, room: true, code: true } })).map((i) => [
      key(i.name, i.room),
      i.code,
    ]),
  );
  const seenSerials = new Map<string, string>(); // serial -> ref, for the dry run
  const knownSerials = new Set(
    (
      await db.item.findMany({
        where: { serialNumber: { not: null } },
        select: { serialNumber: true },
      })
    ).flatMap((i) => (i.serialNumber ? [i.serialNumber] : [])),
  );
  const inFile = new Map<string, string>(); // key -> ref

  for (const c of built.candidates) {
    const k = key(c.input.name, c.input.room);
    const code = existing.get(k);
    if (code) {
      report.skippedDuplicate.push({
        ref: c.ref,
        row: c.row,
        reason: `sudah ada sebagai ${code} (nama dan ruang sama)`,
      });
      report.map.push({ ref: c.ref, code, status: "sudah ada" });
      continue;
    }
    const first = inFile.get(k);
    if (first) {
      report.skippedDuplicate.push({
        ref: c.ref,
        row: c.row,
        reason: `nama dan ruang sama dengan ref "${first}" di berkas ini`,
      });
      continue;
    }
    inFile.set(k, c.ref);

    const serial = c.input.serialNumber?.trim();
    if (opts.dryRun) {
      if (serial && (knownSerials.has(serial) || seenSerials.has(serial))) {
        report.warnings.push(
          `Baris ${c.row} (items): nomor seri ${serial} sudah dipakai barang lain`,
        );
      }
      if (serial) seenSerials.set(serial, c.ref);
      report.created++;
      report.contentsCreated += c.input.contents?.length ?? 0;
      report.map.push({ ref: c.ref, code: "", status: "akan dibuat" });
      continue;
    }

    try {
      const { item, warnings } = await registerItem(actor, c.input);
      report.created++;
      report.contentsCreated += c.input.contents?.length ?? 0;
      report.map.push({ ref: c.ref, code: item.code, status: "dibuat" });
      for (const w of warnings) {
        report.warnings.push(
          `Baris ${c.row} (items): nomor seri ${serial} juga dipakai ${w.codes.join(", ")}`,
        );
      }
    } catch (e) {
      // The item's transaction rolled back; carry on with the others.
      report.skippedInvalid++;
      report.issues.push({
        file: "items",
        row: c.row,
        message: `Gagal disimpan: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }
  return report;
}

/** Exit code the CLI should use: errors mean non-zero even when valid rows went through. */
export const hasErrors = (r: ImportReport) => r.issues.length > 0;

function field(v: string) {
  return /[",\n\r;]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
}

/** ref -> code mapping, so the source sheet can be annotated with the assigned codes. */
export function formatMapCsv(map: MapEntry[]): string {
  return `${["ref,code,status", ...map.map((m) => [m.ref, m.code, m.status].map(field).join(","))].join("\n")}\n`;
}

const FILE_NAME = { items: "items.csv", contents: "contents.csv" } as const;

/** Human-readable summary (Indonesian) for the terminal. */
export function formatReport(r: ImportReport): string {
  const lines: string[] = [];
  for (const i of r.issues) lines.push(`GALAT  ${FILE_NAME[i.file]} baris ${i.row}: ${i.message}`);
  for (const d of r.skippedDuplicate) {
    lines.push(`LEWAT  items.csv baris ${d.row} (ref ${d.ref}): ${d.reason}`);
  }
  for (const w of r.warnings) lines.push(`PERINGATAN  ${w}`);
  if (lines.length > 0) lines.push("");
  if (r.blocked) {
    lines.push(
      "Tidak ada yang diimpor: perbaiki galat di atas, atau jalankan dengan --skip-invalid.",
    );
  }
  lines.push(
    r.dryRun ? "Ringkasan (dry-run, tidak ada yang ditulis):" : "Ringkasan:",
    `  Baris barang   : ${r.itemRows}`,
    `  Baris isi      : ${r.contentRows}`,
    `  ${r.dryRun ? "Akan dibuat " : "Dibuat       "} : ${r.created} barang, ${r.contentsCreated} baris isi`,
    `  Dilewati (ada) : ${r.skippedDuplicate.length}`,
    `  Dilewati (galat): ${r.skippedInvalid}`,
    `  Galat          : ${r.issues.length}`,
    `  Peringatan     : ${r.warnings.length}`,
  );
  return lines.join("\n");
}

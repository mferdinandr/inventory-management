"use server";

import { revalidatePath } from "next/cache";
import { assertAction } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { type ExcelReport, importExcel } from "@/server/import/xlsx-run";

export type ImportState = { error?: string; report?: ExcelReport } | undefined;

/** Keep below the 4 MB body limit configured in next.config.ts (Vercel allows 4.5 MB). */
const MAX_BYTES = 4 * 1024 * 1024;

/** `intent` = "preview" validates only; "import" writes. Both receive the file again. */
export async function importExcelAction(_prev: ImportState, form: FormData): Promise<ImportState> {
  try {
    const actor = await assertAction("item.create");
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Pilih berkas Excel (.xlsx) terlebih dahulu" };
    }
    if (file.size > MAX_BYTES) return { error: "Berkas terlalu besar (maksimal 4 MB)" };
    const dryRun = form.get("intent") !== "import";
    const report = await importExcel(actor, await file.arrayBuffer(), dryRun);
    if (!dryRun && report.created > 0) revalidatePath("/items");
    return { report };
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    // parseWorkbook throws a plain Error with a readable message for non-xlsx files.
    if (e instanceof Error && e.message.startsWith("Berkas")) return { error: e.message };
    throw e;
  }
}

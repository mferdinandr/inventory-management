"use client";

import { useActionState } from "react";
import { Button, Input, Label, Notice } from "@/components/ui";
import { importExcelAction } from "../import-actions";

/** Upload an Excel inventory list; preview first, then import. The file stays in the form. */
export function ExcelImport() {
  const [state, action, pending] = useActionState(importExcelAction, undefined);
  const report = state?.report;
  const done = report && !report.dryRun && !report.blocked;

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-semibold">Impor dari Excel</h2>
      <p className="text-sm text-slate-600">
        Unggah berkas .xlsx daftar inventaris. Setiap ID item (mis. MINOR 1) menjadi satu barang
        perlu sterilisasi, dan setiap barisnya menjadi isi. Kolom yang dibaca: NAMA ITEM, MEREK,
        KONDISI, JUMLAH, Catatan. Sheet tanpa kolom NAMA ITEM dilewati.
      </p>
      <form action={action} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="excel-file">Berkas Excel</Label>
          <Input id="excel-file" name="file" type="file" accept=".xlsx" required />
        </div>
        <div className="flex gap-2">
          <Button type="submit" name="intent" value="preview" variant="outline" disabled={pending}>
            Periksa dulu
          </Button>
          <Button type="submit" name="intent" value="import" disabled={pending}>
            Impor
          </Button>
        </div>
      </form>

      {state?.error && <Notice tone="error">{state.error}</Notice>}

      {report && (
        <div className="space-y-2 text-sm">
          {report.issues.length > 0 && (
            <Notice tone="error">
              <p className="font-medium">
                Tidak ada yang diimpor. Perbaiki {report.issues.length} galat berikut lalu unggah
                ulang:
              </p>
              <ul className="mt-1 list-disc pl-5">
                {report.issues.map((i) => (
                  <li key={`${i.sheet}-${i.row}-${i.message}`}>
                    Sheet {i.sheet} baris {i.row}: {i.message}
                  </li>
                ))}
              </ul>
            </Notice>
          )}
          {!report.blocked && (
            <Notice tone="success">
              {done ? "Selesai: " : "Pratinjau (belum disimpan): "}
              {report.created} barang dan {report.contentsCreated} baris isi
              {done ? " dibuat" : " akan dibuat"}.
            </Notice>
          )}
          {report.skippedDuplicate.length > 0 && (
            <div>
              <p className="font-medium">Dilewati ({report.skippedDuplicate.length}):</p>
              <ul className="list-disc pl-5 text-slate-600">
                {report.skippedDuplicate.map((d) => (
                  <li key={`${d.sheet}-${d.row}`}>
                    {d.name} (sheet {d.sheet} baris {d.row}): {d.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {report.skippedSheets.length > 0 && (
            <p className="text-slate-600">
              Sheet dilewati:{" "}
              {report.skippedSheets.map((s) => `${s.sheet} (${s.reason})`).join("; ")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

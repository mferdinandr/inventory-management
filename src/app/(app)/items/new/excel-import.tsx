"use client";

import { type FormEvent, useRef, useState, useTransition } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Notice,
} from "@/components/ui";
import type { ImportState } from "../import-actions";
import { importExcelAction } from "../import-actions";

/** Upload an Excel inventory list: "Impor" opens a preview, "Proses" in the preview writes. */
export function ExcelImport() {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ImportState>();
  const [pending, startTransition] = useTransition();

  const run = (intent: "preview" | "import") => {
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    data.set("intent", intent);
    startTransition(async () => {
      setState(await importExcelAction(undefined, data));
      setOpen(true);
    });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    run("preview");
  };

  const report = state?.report;
  const done = !!report && !report.dryRun && !report.blocked;
  const canProcess = !!report && report.dryRun && !report.blocked && report.created > 0;

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-semibold">Impor dari Excel</h2>
      <p className="text-sm text-slate-600">
        Unggah berkas .xlsx daftar inventaris. Setiap ID item (mis. MINOR 1) menjadi satu barang
        perlu sterilisasi, dan setiap barisnya menjadi isi. Kolom yang dibaca: NAMA ITEM, MEREK,
        KONDISI, JUMLAH, Catatan. Sheet tanpa kolom NAMA ITEM dilewati.
      </p>
      <form ref={formRef} onSubmit={onSubmit} className="space-y-2">
        <Label htmlFor="excel-file">Berkas Excel</Label>
        <div className="flex gap-2">
          <Input id="excel-file" name="file" type="file" accept=".xlsx" required />
          <Button type="submit" disabled={pending}>
            {pending ? "Memproses..." : "Impor"}
          </Button>
        </div>
      </form>
      {state?.error && !open && <Notice tone="error">{state.error}</Notice>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{done ? "Impor selesai" : "Pratinjau impor"}</DialogTitle>
            <DialogDescription>
              {done ? "Data sudah disimpan." : "Periksa dulu; belum ada yang disimpan."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 text-sm">
            {state?.error && <Notice tone="error">{state.error}</Notice>}
            {report && report.issues.length > 0 && (
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
            {report && !report.blocked && (
              <Notice tone="success">
                {report.created} barang dan {report.contentsCreated} baris isi{" "}
                {done ? "dibuat" : "akan dibuat"}.
              </Notice>
            )}
            {report && report.skippedDuplicate.length > 0 && (
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
            {report && report.skippedSheets.length > 0 && (
              <p className="text-slate-600">
                Sheet dilewati:{" "}
                {report.skippedSheets.map((s) => `${s.sheet} (${s.reason})`).join("; ")}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              {done ? "Tutup" : "Batal"}
            </Button>
            {canProcess && (
              <Button onClick={() => run("import")} disabled={pending}>
                {pending ? "Memproses..." : "Proses"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

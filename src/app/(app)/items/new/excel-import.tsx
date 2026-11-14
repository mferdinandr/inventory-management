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
import { t } from "@/lib/strings";
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
      <a
        href="/api/items/import-template"
        className="inline-block text-sm text-primary underline underline-offset-4"
      >
        Unduh template impor (.xlsx)
      </a>
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
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
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
            {report && !report.blocked && <PreviewTables report={report} />}
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

const f = t.items.fields;
const c = t.items.contents;

/** Excel column -> field in the web form, so the preview reads in the app's own labels. */
const MAPPING: [string, string][] = [
  ["ID item / Column 1", `${f.name} (barang)`],
  ["NAMA ITEM", `${c.name} (isi)`],
  ["MEREK", c.brand],
  ["JUMLAH", `${c.quantity} (kosong = 1)`],
  ['KONDISI berisi "rusak"', `${c.damaged} (= ${c.quantity})`],
  ["Catatan", c.note],
  ["Status, TANGGAL VERIVIKASI", "tidak diimpor"],
];

function PreviewTables({ report }: { report: NonNullable<ImportState>["report"] & object }) {
  if (report.preview.length === 0) return null;
  return (
    <div className="space-y-3">
      <table className="w-full border-collapse text-left text-xs">
        <caption className="pb-1 text-left font-medium">Pemetaan kolom</caption>
        <thead>
          <tr className="border-b bg-slate-50">
            <th className="px-2 py-1">Kolom di Excel</th>
            <th className="px-2 py-1">Kolom di web</th>
          </tr>
        </thead>
        <tbody>
          {MAPPING.map(([from, to]) => (
            <tr key={from} className="border-b">
              <td className="px-2 py-1">{from}</td>
              <td className="px-2 py-1">{to}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div>
        <p className="pb-1 font-medium">
          Yang akan diimpor ({report.preview.length} barang; klik untuk melihat isinya)
        </p>
        <div className="grid grid-cols-[1fr_5rem_5rem_5rem_6rem] gap-2 border-b bg-slate-50 px-2 py-1 text-xs font-medium">
          <span>{f.name}</span>
          <span>{f.needsSterilization}</span>
          <span>Baris isi</span>
          <span>{c.damaged}</span>
          <span>Sheet</span>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {report.preview.map((s) => (
            <details key={`${s.sheet}-${s.row}`} className="border-b text-xs">
              <summary className="grid cursor-pointer grid-cols-[1fr_5rem_5rem_5rem_6rem] gap-2 px-2 py-1">
                <span className="font-medium">{s.name}</span>
                <span>Ya</span>
                <span>{s.contents.length}</span>
                <span>{s.contents.reduce((n, x) => n + x.damagedQuantity, 0)}</span>
                <span>{s.sheet}</span>
              </summary>
              <table className="mb-2 w-full border-collapse text-left">
                <thead>
                  <tr className="border-y bg-slate-50">
                    <th className="px-2 py-1">{c.name}</th>
                    <th className="px-2 py-1">{c.brand}</th>
                    <th className="px-2 py-1">{c.quantity}</th>
                    <th className="px-2 py-1">{c.damaged}</th>
                    <th className="px-2 py-1">{c.note}</th>
                  </tr>
                </thead>
                <tbody>
                  {s.contents.map((x) => (
                    <tr key={x.name} className="border-b">
                      <td className="px-2 py-1">{x.name}</td>
                      <td className="px-2 py-1">{x.brand ?? "-"}</td>
                      <td className="px-2 py-1">{x.quantity}</td>
                      <td className="px-2 py-1">{x.damagedQuantity}</td>
                      <td className="px-2 py-1">{x.note ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";

import { ChevronRight } from "lucide-react";
import { type FormEvent, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Badge,
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
      const result = await importExcelAction(undefined, data);
      const r = result?.report;
      if (intent === "import" && r && !r.blocked) {
        setOpen(false);
        setState(undefined);
        formRef.current?.reset();
        toast.success(
          `Impor berhasil: ${r.created} barang dan ${r.contentsCreated} baris isi dibuat.`,
        );
        return;
      }
      setState(result);
      setOpen(true);
    });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    run("preview");
  };

  const report = state?.report;
  const canProcess = !!report && report.dryRun && !report.blocked && report.created > 0;

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h2 className="text-lg font-semibold">Impor dari Excel</h2>
      <a
        href="/api/items/import-template"
        className="inline-block text-sm text-primary underline underline-offset-4"
      >
        Unduh template impor (.xlsx)
      </a>
      <MappingTable />
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
            <DialogTitle>Pratinjau impor</DialogTitle>
            <DialogDescription>Periksa dulu; belum ada yang disimpan.</DialogDescription>
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
                {report.created} barang dan {report.contentsCreated} baris isi akan dibuat.
              </Notice>
            )}
            {report && !report.blocked && <PreviewTables report={report} />}
            {report && report.skippedDuplicate.length > 0 && (
              <div>
                <p className="font-medium">Dilewati ({report.skippedDuplicate.length}):</p>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {report.skippedDuplicate.map((d) => (
                    <li key={`${d.sheet}-${d.row}`}>
                      {d.name} (sheet {d.sheet} baris {d.row}): {d.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Batal
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

const ROW = "grid grid-cols-[minmax(10rem,1fr)_7rem_5rem_4rem_8rem] items-center gap-3 px-3";
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

const TH = "px-3 py-2 text-xs font-medium text-muted-foreground";
const TD = "px-3 py-2 align-top";

/** A count; damaged counts above zero stand out, zero stays quiet. */
function Count({ n, damaged }: { n: number; damaged?: boolean }) {
  if (damaged && n > 0) return <Badge variant="destructive">{n}</Badge>;
  return <span className={damaged ? "text-muted-foreground" : undefined}>{n}</span>;
}

function MappingTable() {
  return (
    <section>
      <h3 className="pb-1.5 text-sm font-medium">Pemetaan kolom</h3>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="bg-muted">
            <tr>
              <th className={TH}>Kolom di Excel</th>
              <th className={TH}>Kolom di web</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {MAPPING.map(([from, to]) => (
              <tr key={from}>
                <td className="px-3 py-1.5">{from}</td>
                <td
                  className={`px-3 py-1.5 ${to === "tidak diimpor" ? "text-muted-foreground" : ""}`}
                >
                  {to}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PreviewTables({ report }: { report: NonNullable<ImportState>["report"] & object }) {
  return (
    <div className="space-y-4">
      <section>
        <h3 className="pb-1.5 text-sm font-medium">
          Yang akan diimpor ({report.preview.length} barang)
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            Klik barang untuk melihat isinya
          </span>
        </h3>
        <div className="max-h-80 overflow-auto rounded-lg border border-border">
          <div className="min-w-[38rem]">
            <div className={`${ROW} sticky top-0 z-10 border-b border-border bg-muted py-2 pl-9`}>
              {[f.name, f.needsSterilization, "Baris isi", c.damaged, "Sheet"].map((h) => (
                <span key={h} className="text-xs font-medium text-muted-foreground">
                  {h}
                </span>
              ))}
            </div>
            {report.preview.map((s) => (
              <details
                key={`${s.sheet}-${s.row}`}
                className="group border-b border-border text-sm last:border-b-0 open:bg-muted/30"
              >
                <summary
                  className={`${ROW} cursor-pointer list-none py-2 hover:bg-muted/50 [&::-webkit-details-marker]:hidden`}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <ChevronRight
                      aria-hidden
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                    />
                    {s.name}
                  </span>
                  <Badge variant="secondary" className="justify-self-start">
                    Ya
                  </Badge>
                  <span>{s.contents.length}</span>
                  <Count n={s.contents.reduce((n, x) => n + x.damagedQuantity, 0)} damaged />
                  <Badge variant="outline" className="justify-self-start">
                    {s.sheet}
                  </Badge>
                </summary>
                <div className="mx-3 mb-3 ml-9 overflow-hidden rounded-lg border border-border bg-card">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="bg-muted">
                      <tr>
                        <th className={TH}>{c.name}</th>
                        <th className={TH}>{c.brand}</th>
                        <th className={`${TH} text-right`}>{c.quantity}</th>
                        <th className={`${TH} text-right`}>{c.damaged}</th>
                        <th className={TH}>{c.note}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {s.contents.map((x) => (
                        <tr key={x.name}>
                          <td className={`${TD} font-medium`}>{x.name}</td>
                          <td className={`${TD} text-muted-foreground`}>{x.brand ?? "-"}</td>
                          <td className={`${TD} text-right tabular-nums`}>{x.quantity}</td>
                          <td className={`${TD} text-right tabular-nums`}>
                            <Count n={x.damagedQuantity} damaged />
                          </td>
                          <td className={`${TD} text-muted-foreground`}>{x.note ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        </div>
        {report.skippedSheets.length > 0 && (
          <p className="pt-1.5 text-xs text-muted-foreground">
            Sheet dilewati: {report.skippedSheets.map((s) => `${s.sheet} (${s.reason})`).join("; ")}
          </p>
        )}
      </section>
    </div>
  );
}

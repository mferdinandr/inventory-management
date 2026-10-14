import type { Metadata } from "next";
import { ItemLabel } from "@/components/item-label";
import { PrintButton } from "@/components/print-button";
import { Notice } from "@/components/ui";
import { normalizeItemCode } from "@/lib/item-code";
import { t } from "@/lib/strings";
import { requireAction } from "@/server/auth/session";
import { findItemByCode } from "@/server/services/item-lookup";

export const metadata: Metadata = { title: t.print.sheetTitle };

const MAX_LABELS = 200;

export default async function SheetPage({
  searchParams,
}: {
  searchParams: Promise<{ codes?: string }>;
}) {
  await requireAction("label.print");
  const raw = (await searchParams).codes ?? "";
  const codes = [
    ...new Set(
      raw
        .split(",")
        .map((c) => normalizeItemCode(c))
        .filter((c): c is string => c !== null),
    ),
  ].slice(0, MAX_LABELS);

  const found = (await Promise.all(codes.map(findItemByCode))).filter((i) => i !== null);
  const known = new Set(found.map((i) => i.code));
  const missing = codes.filter((c) => !known.has(c));

  return (
    <>
      <style>{"@page { size: A4; margin: 10mm } @media print { body { background: #fff } }"}</style>
      <div className="space-y-3 p-4 print:hidden">
        <PrintButton />
        {found.length === 0 && <Notice tone="error">{t.print.noCodes}</Notice>}
        {missing.length > 0 && <Notice tone="error">{t.print.missing(missing.join(", "))}</Notice>}
      </div>
      <div className="grid w-[160mm] grid-cols-[repeat(3,50mm)] gap-[5mm] px-4 print:p-0">
        {found.map((item) => (
          <div
            key={item.code}
            className="break-inside-avoid border border-dashed border-slate-300 print:border-0"
          >
            <ItemLabel code={item.code} name={item.name} />
          </div>
        ))}
      </div>
    </>
  );
}

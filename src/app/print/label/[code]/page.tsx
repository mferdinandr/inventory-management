import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ItemLabel } from "@/components/item-label";
import { PrintButton } from "@/components/print-button";
import { normalizeItemCode } from "@/lib/item-code";
import { t } from "@/lib/strings";
import { requireAction } from "@/server/auth/session";
import { findItemByCode } from "@/server/services/item-lookup";

export const metadata: Metadata = { title: t.print.labelTitle };

export default async function LabelPage({ params }: { params: Promise<{ code: string }> }) {
  await requireAction("label.print");
  const code = normalizeItemCode((await params).code);
  const item = code ? await findItemByCode(code) : null;
  if (!item) notFound();

  return (
    <>
      {/* The browser prints exactly one label: no margins, no app chrome. */}
      <style>
        {"@page { size: 50mm 30mm; margin: 0 } @media print { body { background: #fff } }"}
      </style>
      <div className="p-4 print:hidden">
        <PrintButton />
      </div>
      <div className="mx-4 w-[50mm] border border-dashed border-slate-300 print:m-0 print:border-0">
        <ItemLabel code={item.code} name={item.name} />
      </div>
    </>
  );
}

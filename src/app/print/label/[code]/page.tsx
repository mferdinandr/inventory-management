import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ItemLabel } from "@/components/item-label";
import { LabelSizePicker } from "@/components/label-size-picker";
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
      <LabelSizePicker>
        <ItemLabel code={item.code} name={item.name} />
      </LabelSizePicker>
    </>
  );
}

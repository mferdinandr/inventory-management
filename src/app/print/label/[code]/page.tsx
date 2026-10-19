import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LabelSizePicker } from "@/components/label-size-picker";
import { normalizeItemCode } from "@/lib/item-code";
import { t } from "@/lib/strings";
import { requireAction } from "@/server/auth/session";
import { qrSvg } from "@/server/qr";
import { findItemByCode } from "@/server/services/item-lookup";

export const metadata: Metadata = { title: t.print.labelTitle };

export default async function LabelPage({ params }: { params: Promise<{ code: string }> }) {
  await requireAction("label.print");
  const code = normalizeItemCode((await params).code);
  const item = code ? await findItemByCode(code) : null;
  if (!item) notFound();

  const svg = await qrSvg(item.code, 256);
  const qrSrc = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

  return (
    <>
      {/* The browser prints exactly one label: no margins, no app chrome. */}
      <div className="p-4 pb-0 print:hidden">
        <Link
          href={`/items/${encodeURIComponent(item.code)}`}
          className="-ml-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {t.print.back}
        </Link>
      </div>
      <LabelSizePicker code={item.code} name={item.name} qrSrc={qrSrc} />
    </>
  );
}

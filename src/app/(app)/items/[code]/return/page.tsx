import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import { t } from "@/lib/strings";
import { requireUser } from "@/server/auth/session";
import { getItemByCode } from "@/server/services/item.service";
import { ReturnForm } from "./form";

export const metadata: Metadata = { title: t.flow.returnTitle };

export default async function ReturnPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await requireUser();
  const item = await getItemByCode(decodeURIComponent((await params).code));
  if (!item) notFound();
  const back = `/items/${encodeURIComponent(item.code)}`;
  const returnable =
    !item.isArchived && item.location === "CSSD" && can(user.role, "item.return", item);
  if (!returnable) redirect(back);

  return (
    <section className="space-y-4">
      <Link href={back} className="inline-block py-2 text-teal-800 underline">
        {t.flow.back}
      </Link>
      <h1 className="text-2xl font-bold">
        {t.flow.returnTitle}: {item.name}
      </h1>
      <p className="font-mono text-sm text-slate-600">{item.code}</p>
      <p className="text-slate-600">{t.flow.returnIntro}</p>
      <ReturnForm
        id={item.id}
        version={item.version}
        contents={item.contents.map((c) => ({
          id: c.id,
          name: c.name,
          brand: c.brand ?? "",
          quantity: c.quantity,
          damagedQuantity: c.damagedQuantity,
          note: c.note ?? "",
        }))}
      />
    </section>
  );
}

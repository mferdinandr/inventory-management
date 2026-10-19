import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import { t } from "@/lib/strings";
import { requireUser } from "@/server/auth/session";
import { getItemByCode } from "@/server/services/item.service";
import { LinkButton } from "../../link-button";
import { SendForm } from "./form";

export const metadata: Metadata = { title: t.flow.sendTitle };

export default async function SendPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await requireUser();
  const item = await getItemByCode(decodeURIComponent((await params).code));
  if (!item) notFound();
  const back = `/items/${encodeURIComponent(item.code)}`;
  const sendable =
    !item.isArchived &&
    item.needsSterilization &&
    item.location === "OPERASI" &&
    can(user.role, "item.send", item);
  if (!sendable) redirect(back);

  return (
    <section className="space-y-4">
      <LinkButton href={back} variant="ghost" className="-ml-3 text-muted-foreground">
        <ArrowLeft className="size-4" />
        {t.flow.back}
      </LinkButton>
      <h1 className="text-2xl font-bold">
        {t.flow.sendTitle}: {item.name}
      </h1>
      <p className="font-mono text-sm text-slate-600">{item.code}</p>
      <p className="text-slate-600">{t.flow.sendIntro}</p>
      <SendForm id={item.id} />
    </section>
  );
}

import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { t } from "@/lib/strings";
import { requireAction } from "@/server/auth/session";
import { findItemForMaintenance } from "@/server/services/maintenance.service";
import { LinkButton } from "../../../link-button";
import { MaintenanceForm } from "./form";

export const metadata: Metadata = { title: t.maintenance.newTitle };

export default async function NewMaintenancePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  await requireAction("maintenance.create");
  const code = decodeURIComponent((await params).code);
  const item = await findItemForMaintenance(code);
  if (!item) notFound();
  const back = `/items/${encodeURIComponent(item.code)}/maintenance`;
  if (item.isArchived) redirect(back);

  // Today's date where the hospital is, whatever timezone the server runs in.
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

  return (
    <section className="space-y-4">
      <LinkButton href={back} variant="ghost" className="-ml-3 text-muted-foreground">
        <ArrowLeft className="size-4" />
        {t.maintenance.back}
      </LinkButton>

      <div className="overflow-hidden rounded-2xl border border-ink-200 bg-card shadow-2xl shadow-brand-900/10">
        <div className="px-6 pt-8 pb-7 sm:px-10 sm:pt-10 sm:pb-8">
          <div className="mb-8">
            <p className="font-mono text-sm text-muted-foreground">{item.code}</p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-ink-900">
              {t.maintenance.newTitle}: {item.name}
            </h1>
          </div>
          <MaintenanceForm
            code={item.code}
            today={today}
            quantity={item.quantity}
            damaged={item.damagedQuantity}
          />
        </div>
      </div>
    </section>
  );
}

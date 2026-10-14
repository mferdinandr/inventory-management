import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { t } from "@/lib/strings";
import { requireAction } from "@/server/auth/session";
import { findItemForMaintenance } from "@/server/services/maintenance.service";
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
      <Link href={back} className="inline-block py-2 text-teal-800 underline">
        {t.maintenance.back}
      </Link>
      <h1 className="text-2xl font-bold">
        {t.maintenance.newTitle}: {item.name}
      </h1>
      <MaintenanceForm
        code={item.code}
        today={today}
        quantity={item.quantity}
        damaged={item.damagedQuantity}
      />
    </section>
  );
}

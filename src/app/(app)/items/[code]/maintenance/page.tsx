import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MaintenanceButton } from "@/components/maintenance-button";
import { MaintenanceList } from "@/components/maintenance-list";
import { t } from "@/lib/strings";
import { requireUser } from "@/server/auth/session";
import {
  findItemForMaintenance,
  getNextDue,
  listMaintenance,
} from "@/server/services/maintenance.service";

export const metadata: Metadata = { title: t.maintenance.title };

type Props = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ cursor?: string }>;
};

export default async function MaintenancePage({ params, searchParams }: Props) {
  await requireUser();
  const { code } = await params;
  const { cursor } = await searchParams;
  const item = await findItemForMaintenance(decodeURIComponent(code));
  if (!item) notFound();

  const [{ records, nextCursor }, nextDue] = await Promise.all([
    listMaintenance(item.id, cursor),
    getNextDue(item.id),
  ]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">
          <span className="font-mono text-lg text-slate-600">[{item.code}]</span>{" "}
          {t.maintenance.title}: {item.name}
        </h1>
        <div className="ml-auto">
          <MaintenanceButton code={item.code} />
        </div>
      </div>
      {nextDue && (
        <p className="text-slate-700">
          {t.maintenance.nextDue}:{" "}
          <strong>
            {nextDue.toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })}
          </strong>
        </p>
      )}
      <MaintenanceList records={records} />
      {nextCursor && (
        <Link
          href={`/items/${encodeURIComponent(item.code)}/maintenance?cursor=${nextCursor}`}
          className="inline-block py-2 text-teal-800 underline"
        >
          {t.maintenance.loadMore}
        </Link>
      )}
    </section>
  );
}

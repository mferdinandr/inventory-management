import { Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const metadata: Metadata = { title: t.public.title };

import { ContentsList } from "@/app/(app)/items/contents-list";
import { formatAge, formatDate, formatDateTime, formatRupiah } from "@/app/(app)/items/format";
import { History } from "@/app/(app)/items/history";
import { MaintenanceList } from "@/components/maintenance-list";
import { t } from "@/lib/strings";
import { getCurrentUser } from "@/server/auth/session";
import { getItemByCode } from "@/server/services/item.service";
import { getNextDue, listMaintenance } from "@/server/services/maintenance.service";

/** Public QR target (docs/04 §5.1): full read-only item info, no sign-in needed. */
export default async function PublicItemPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await getCurrentUser();
  const code = decodeURIComponent((await params).code);
  const target = `/items/${encodeURIComponent(code)}`;
  if (user) redirect(target);

  const item = await getItemByCode(code);
  if (!item) notFound();

  const [maintenance, nextDue] = await Promise.all([listMaintenance(item.id), getNextDue(item.id)]);

  const f = t.items.fields;
  const d = t.items.detail;
  const publicStr = t.public;

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-6 sm:px-6">
      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          {publicStr.note}{" "}
          <Link
            href={`/login?next=${encodeURIComponent(target)}`}
            className="font-medium underline"
          >
            {publicStr.signIn}
          </Link>
        </p>
      </div>

      <div className="rounded-2xl border border-ink-200 bg-card p-6 shadow-sm sm:p-8">
        <p className="font-mono text-sm text-slate-500">{item.code}</p>
        <h1 className="mt-1 text-2xl font-bold">{item.name}</h1>
      </div>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">{d.identity}</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">{f.needsSterilization}</dt>
            <dd>{item.needsSterilization ? t.items.yes : t.items.no}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{f.location}</dt>
            <dd>
              {t.items.locations[item.location]}
              {item.needsSterilization && (
                <span className="block text-slate-500">
                  {d.locationSince} {formatDateTime(item.locationSince)} (
                  {t.items.list.since(formatAge(item.locationSince))})
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{f.room}</dt>
            <dd>{item.room}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{f.quantity}</dt>
            <dd>
              {t.items.list.quantity(item.quantity, item.damagedQuantity)}
              {item.damagedQuantity > 0 && (
                <span className="block text-slate-500">
                  {d.goodQuantity(item.quantity - item.damagedQuantity)}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{f.brand}</dt>
            <dd>{item.brand ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{f.model}</dt>
            <dd>{item.model ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{f.serialNumber}</dt>
            <dd>{item.serialNumber ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{d.createdAt}</dt>
            <dd>{formatDateTime(item.createdAt)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-500">{f.description}</dt>
            <dd>{item.description ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">{d.purchase}</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">{f.purchaseDate}</dt>
            <dd>{item.purchaseDate ? formatDate(item.purchaseDate) : "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{f.purchasePrice}</dt>
            <dd>{item.purchasePrice !== null ? formatRupiah(item.purchasePrice) : "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{f.supplier}</dt>
            <dd>{item.supplier ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{f.fundingSource}</dt>
            <dd>{item.fundingSource ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{f.warrantyUntil}</dt>
            <dd>{item.warrantyUntil ? formatDate(item.warrantyUntil) : "—"}</dd>
          </div>
        </dl>
      </section>

      {item.contents.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">{d.contents}</h2>
          <ContentsList rows={item.contents} />
        </section>
      )}

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">{t.maintenance.title}</h2>
        {nextDue && (
          <p className="text-sm text-slate-600">
            {t.maintenance.nextDue}: <strong>{formatDate(nextDue)}</strong>
          </p>
        )}
        <MaintenanceList records={maintenance.records} />
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">{d.history}</h2>
        <History logs={item.logs} />
      </section>
    </main>
  );
}

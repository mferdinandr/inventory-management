import { Pencil, Printer, Undo2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MaintenanceButton } from "@/components/maintenance-button";
import { MaintenanceList } from "@/components/maintenance-list";
import { can } from "@/lib/permissions";
import { t } from "@/lib/strings";
import { requireUser } from "@/server/auth/session";
import { getItemByCode } from "@/server/services/item.service";
import { getNextDue, listMaintenance } from "@/server/services/maintenance.service";
import { ArchiveButton } from "../archive-button";
import { ContentsList } from "../contents-list";
import { formatAge, formatDate, formatDateTime, formatRupiah } from "../format";
import { History } from "../history";
import { LinkButton } from "../link-button";

type Params = Promise<{ code: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return { title: decodeURIComponent((await params).code) };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-base">{children || t.items.detail.empty}</dd>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default async function ItemPage({ params }: { params: Params }) {
  const user = await requireUser();
  const item = await getItemByCode(decodeURIComponent((await params).code));
  if (!item) notFound();

  const [maintenance, nextDue] = await Promise.all([listMaintenance(item.id), getNextDue(item.id)]);

  const state = { location: item.location, needsSterilization: item.needsSterilization };
  const canEdit =
    !item.isArchived &&
    (can(user.role, "item.editDetails", state) || can(user.role, "item.editContents", state));
  const canArchive = can(user.role, "item.archive", state);
  const d = t.items.detail;
  const f = t.items.fields;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm text-slate-600">{item.code}</p>
          <h1 className="text-2xl font-bold">{item.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <LinkButton href={`/items/${item.code}/edit`} variant="outline">
              <Pencil className="size-4" />
              {t.items.edit}
            </LinkButton>
          )}
          {can(user.role, "label.print", state) && (
            <LinkButton href={`/print/label/${item.code}`} variant="outline">
              <Printer className="size-4" />
              {t.items.printLabel}
            </LinkButton>
          )}
          {!item.isArchived &&
            item.needsSterilization &&
            item.location === "OPERASI" &&
            can(user.role, "item.send", state) && (
              <LinkButton href={`/items/${encodeURIComponent(item.code)}/send`}>
                {t.flow.send}
              </LinkButton>
            )}
          {!item.isArchived && item.location === "CSSD" && can(user.role, "item.return", state) && (
            <LinkButton href={`/items/${encodeURIComponent(item.code)}/return`}>
              <Undo2 className="size-4" />
              {t.flow.return}
            </LinkButton>
          )}
        </div>
      </div>

      {item.isArchived && (
        <p className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm">
          {d.archivedNotice}
        </p>
      )}
      {item.duplicateSerialCodes.length > 0 && (
        <p
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {d.duplicateSerial(item.duplicateSerialCodes)}
        </p>
      )}

      <Card title={d.identity}>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label={f.needsSterilization}>
            {item.needsSterilization ? t.items.yes : t.items.no}
          </Field>
          <Field label={f.location}>
            {t.items.locations[item.location]}
            {item.needsSterilization && (
              <span className="block text-sm text-slate-500">
                {d.locationSince} {formatDateTime(item.locationSince)} (
                {t.items.list.since(formatAge(item.locationSince))})
              </span>
            )}
          </Field>
          <Field label={f.room}>{item.room}</Field>
          <Field label={f.quantity}>
            {t.items.list.quantity(item.quantity, item.damagedQuantity)}
            {item.damagedQuantity > 0 && (
              <span className="block text-sm text-slate-500">
                {d.goodQuantity(item.quantity - item.damagedQuantity)}
              </span>
            )}
          </Field>
          <Field label={f.brand}>{item.brand}</Field>
          <Field label={f.model}>{item.model}</Field>
          <Field label={f.serialNumber}>{item.serialNumber}</Field>
          <Field label={d.createdAt}>{formatDateTime(item.createdAt)}</Field>
          <div className="sm:col-span-2">
            <Field label={f.description}>{item.description}</Field>
          </div>
        </dl>
      </Card>

      <Card title={d.purchase}>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label={f.purchaseDate}>{item.purchaseDate && formatDate(item.purchaseDate)}</Field>
          <Field label={f.purchasePrice}>
            {item.purchasePrice !== null && formatRupiah(item.purchasePrice)}
          </Field>
          <Field label={f.supplier}>{item.supplier}</Field>
          <Field label={f.fundingSource}>{item.fundingSource}</Field>
          <Field label={f.warrantyUntil}>
            {item.warrantyUntil && formatDate(item.warrantyUntil)}
          </Field>
        </dl>
      </Card>

      <Card title={d.contents}>
        <ContentsList rows={item.contents} />
      </Card>

      <Card title={t.maintenance.title}>
        {nextDue && (
          <p className="text-sm text-slate-600">
            {t.maintenance.nextDue}: <strong>{formatDate(nextDue)}</strong>
          </p>
        )}
        <MaintenanceList records={maintenance.records} />
        <div className="flex flex-wrap gap-2">
          {!item.isArchived && <MaintenanceButton code={item.code} />}
          {maintenance.nextCursor && (
            <LinkButton href={`/items/${item.code}/maintenance`} variant="outline">
              {t.items.detail.allMaintenance}
            </LinkButton>
          )}
        </div>
      </Card>

      <Card title={d.history}>
        <History logs={item.logs} />
      </Card>

      {canArchive && <ArchiveButton id={item.id} archived={item.isArchived} />}
    </section>
  );
}

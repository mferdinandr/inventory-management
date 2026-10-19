import { t } from "@/lib/strings";
import type { MaintenanceEntry } from "@/server/services/maintenance.service";

const day = (d: Date) =>
  d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

const rupiah = (n: bigint) => `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;

type Details = Record<string, string | null | undefined>;

/** The labelled lines worth showing for each kind, skipping anything left empty. */
function lines(record: MaintenanceEntry): [label: string, value: string][] {
  const d = record.details as Details;
  const pick: [string, string | null | undefined][] =
    record.type === "PERBAIKAN"
      ? [
          [t.maintenance.complaint, d.complaint],
          [t.maintenance.action, d.action],
          [t.maintenance.parts, d.parts],
          [t.maintenance.finishedOn, d.finished_on ? day(new Date(d.finished_on)) : null],
        ]
      : record.type === "PEMELIHARAAN"
        ? [
            [t.maintenance.activities, d.activities],
            [t.maintenance.findings, d.findings],
          ]
        : [
            [t.maintenance.institution, d.institution],
            [t.maintenance.certificateNo, d.certificate_no],
            [t.maintenance.result, d.result ? t.maintenance.results[d.result as "LULUS"] : null],
            [t.maintenance.validUntil, d.valid_until ? day(new Date(d.valid_until)) : null],
          ];
  return pick.flatMap(([label, value]) => (value ? [[label, value] as [string, string]] : []));
}

/** Maintenance records, newest first, as handed over by `listMaintenance`. */
export function MaintenanceList({ records }: { records: MaintenanceEntry[] }) {
  if (records.length === 0) return <p className="text-slate-600">{t.maintenance.empty}</p>;
  return (
    <ul className="space-y-3">
      {records.map((r) => (
        <li key={r.id} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-semibold">{t.maintenance.types[r.type]}</span>
            <span className="text-sm text-slate-600">{day(r.performedOn)}</span>
            <span className="text-sm text-slate-600">
              {r.performer} · {r.actorName}
            </span>
            {r.cost !== null && <span className="ml-auto text-sm">{rupiah(r.cost)}</span>}
          </div>
          <dl className="mt-2 space-y-1 text-sm">
            {lines(r).map(([label, value]) => (
              <div key={label} className="flex gap-1.5">
                <dt className="shrink-0 text-slate-500">{label}:</dt>
                <dd>{value}</dd>
              </div>
            ))}
            {r.nextDue && (
              <div className="flex gap-1.5">
                <dt className="shrink-0 text-slate-500">{t.maintenance.nextDue}:</dt>
                <dd>{day(r.nextDue)}</dd>
              </div>
            )}
            {r.note && (
              <div className="flex gap-1.5">
                <dt className="shrink-0 text-slate-500">{t.maintenance.note}:</dt>
                <dd>{r.note}</dd>
              </div>
            )}
          </dl>
        </li>
      ))}
    </ul>
  );
}

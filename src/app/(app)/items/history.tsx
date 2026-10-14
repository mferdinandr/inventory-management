import { t } from "@/lib/strings";
import { formatDateTime } from "./format";

type Log = {
  id: string;
  action: "REGISTER" | "EDIT" | "SEND" | "RETURN" | "MAINTENANCE" | "ARCHIVE" | "RESTORE";
  actorName: string;
  note: string | null;
  changes: unknown;
  createdAt: Date;
};

type Change = { name: string; field: string; from: unknown; to: unknown };

const value = (v: unknown) => {
  if (v === null || v === undefined || v === "") return t.items.detail.empty;
  if (v === true) return t.items.yes;
  if (v === false) return t.items.no;
  return String(v);
};

/** One human-readable line for an entry of `item_logs.changes`. */
export function describeChange(c: Change): string {
  const h = t.items.history;
  // A contents row appearing or disappearing is logged as its quantity going from/to null.
  if (c.field === "quantity" && c.from === null) return `${c.name}: ${h.added} (${value(c.to)})`;
  if (c.field === "quantity" && c.to === null) return `${c.name}: ${h.removed}`;
  const field = h.fields[c.field] ?? c.field;
  return h.change(c.name, field, value(c.from), value(c.to));
}

/** The item's history, newest first, read from `item_logs`. */
export function History({ logs }: { logs: Log[] }) {
  if (logs.length === 0) return <p className="text-slate-600">{t.items.detail.noHistory}</p>;
  return (
    <ol className="space-y-4 border-l-2 border-slate-200 pl-4">
      {logs.map((log) => {
        const changes = Array.isArray(log.changes) ? (log.changes as Change[]) : [];
        return (
          <li key={log.id} className="space-y-1">
            <p>
              <span className="font-medium">{t.items.history[log.action]}</span>{" "}
              <span className="text-slate-600">{t.items.history.by(log.actorName)}</span>
            </p>
            <p className="text-xs text-slate-500">{formatDateTime(log.createdAt)}</p>
            {log.note && <p className="text-sm">{log.note}</p>}
            {changes.length > 0 && (
              <ul className="list-disc pl-5 text-sm text-slate-700">
                {changes.map((c, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: a log entry is immutable
                  <li key={`${i}:${c.name}:${c.field}`}>{describeChange(c)}</li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

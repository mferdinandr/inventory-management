import Link from "next/link";
import { formatDateTime } from "@/app/(app)/items/format";
import { describeChange } from "@/app/(app)/items/history";
import { t } from "@/lib/strings";

type Change = Parameters<typeof describeChange>[0];

export type ActivityEntry = {
  id: string;
  action: "REGISTER" | "EDIT" | "SEND" | "RETURN" | "MAINTENANCE" | "ARCHIVE" | "RESTORE";
  actorName: string;
  note: string | null;
  changes: unknown;
  createdAt: Date;
  item: { code: string; name: string };
};

const SHOWN_CHANGES = 2;

/** "Aktivitas terbaru": log entries across items, newest first, each linking to its item. */
export function ActivityTimeline({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0)
    return <p className="text-sm text-muted-foreground">{t.dashboard.noActivity}</p>;
  return (
    <ol className="space-y-4 border-l-2 border-ink-200 pl-4">
      {entries.map((entry) => {
        const changes = Array.isArray(entry.changes) ? (entry.changes as Change[]) : [];
        return (
          <li key={entry.id} className="space-y-1">
            <p className="text-sm">
              <span className="font-medium">{t.items.history[entry.action]}</span>{" "}
              <Link
                href={`/items/${entry.item.code}`}
                className="inline-block py-1 text-primary hover:underline"
              >
                <span className="font-mono text-sm">{entry.item.code}</span> {entry.item.name}
              </Link>
            </p>
            <p className="text-xs text-muted-foreground">
              {t.items.history.by(entry.actorName)} · {formatDateTime(entry.createdAt)}
            </p>
            {entry.note && <p className="text-sm">{entry.note}</p>}
            {changes.length > 0 && (
              <ul className="list-disc pl-5 text-sm text-ink-700">
                {changes.slice(0, SHOWN_CHANGES).map((c, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: a log entry is immutable
                  <li key={`${i}:${c.name}:${c.field}`}>{describeChange(c)}</li>
                ))}
                {changes.length > SHOWN_CHANGES && (
                  <li className="list-none text-muted-foreground">
                    {t.dashboard.moreChanges(changes.length - SHOWN_CHANGES)}
                  </li>
                )}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

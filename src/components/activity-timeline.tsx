import type { LucideIcon } from "lucide-react";
import { Archive, Pencil, PlusCircle, RotateCcw, Send, Undo2, Wrench } from "lucide-react";
import Link from "next/link";
import { formatDateTime } from "@/app/(app)/items/format";
import { describeChange } from "@/app/(app)/items/history";
import { t } from "@/lib/strings";
import { cn } from "@/lib/utils";

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

const actionStyles: Record<ActivityEntry["action"], { icon: LucideIcon; chip: string }> = {
  REGISTER: { icon: PlusCircle, chip: "bg-brand-50 text-brand-700" },
  EDIT: { icon: Pencil, chip: "bg-ink-100 text-ink-600" },
  SEND: { icon: Send, chip: "bg-success-50 text-success-700" },
  RETURN: { icon: Undo2, chip: "bg-amber-50 text-amber-700" },
  MAINTENANCE: { icon: Wrench, chip: "bg-sky-50 text-sky-700" },
  ARCHIVE: { icon: Archive, chip: "bg-ink-100 text-ink-600" },
  RESTORE: { icon: RotateCcw, chip: "bg-brand-50 text-brand-700" },
};

/** "Aktivitas terbaru": log entries across items, newest first, each linking to its item. */
export function ActivityTimeline({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0)
    return <p className="text-sm text-muted-foreground">{t.dashboard.noActivity}</p>;
  return (
    <ol className="space-y-4">
      {entries.map((entry) => {
        const changes = Array.isArray(entry.changes) ? (entry.changes as Change[]) : [];
        const { icon: Icon, chip } = actionStyles[entry.action];
        return (
          <li key={entry.id} className="flex gap-3">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border border-ink-200",
                chip,
              )}
            >
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-sm">
                <span className="font-medium">{t.items.history[entry.action]}</span>{" "}
                <Link
                  href={`/items/${entry.item.code}`}
                  className="inline-block py-1 text-primary hover:underline"
                >
                  <span className="font-mono text-sm">{entry.item.code}</span> {entry.item.name}
                </Link>
              </p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[10px] font-semibold text-ink-600">
                  {entry.actorName.slice(0, 1).toUpperCase()}
                </span>
                {entry.actorName} · {formatDateTime(entry.createdAt)}
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
            </div>
          </li>
        );
      })}
    </ol>
  );
}

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

/** "Due soon" window of the Beranda card and the `dueSoon` list filter (docs/06 §5). */
export const DUE_SOON_DAYS = 30;

export type Summary = { operasi: number; cssd: number; damaged: number; dueSoon: number };

const RECENT_ITEMS = 10;
const RECENT_ACTIVITY = 20;

/** `YYYY-MM-DD` of `now` in the hospital's timezone plus `days`; `date` columns have no zone. */
function dateAhead(now: Date, days: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(now);
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Ids of active items whose earliest next due date is on or before today + 30 days (overdue
 * included). Same rule as `getNextDue`: only the latest PEMELIHARAAN and the latest KALIBRASI
 * record count. The single implementation behind both the summary and the list filter.
 */
export async function dueSoonItemIds(now = new Date()): Promise<string[]> {
  const cutoff = dateAhead(now, DUE_SOON_DAYS);
  const rows = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT i.id
    FROM items i
    LEFT JOIN LATERAL (
      SELECT m.next_due FROM maintenance_records m
      WHERE m.item_id = i.id AND m.type = 'PEMELIHARAAN'
      ORDER BY m.performed_on DESC, m.created_at DESC LIMIT 1
    ) p ON true
    LEFT JOIN LATERAL (
      SELECT m.next_due FROM maintenance_records m
      WHERE m.item_id = i.id AND m.type = 'KALIBRASI'
      ORDER BY m.performed_on DESC, m.created_at DESC LIMIT 1
    ) k ON true
    WHERE NOT i.is_archived
      AND LEAST(p.next_due, k.next_due) <= ${cutoff}::date
  `);
  return rows.map((r) => r.id);
}

/** Counts for the Beranda cards. Archived items are never counted. */
export async function getSummary(now = new Date()): Promise<Summary> {
  const [counts, dueSoon] = await Promise.all([
    db.$queryRaw<{ operasi: bigint; cssd: bigint; damaged: bigint }[]>(Prisma.sql`
      SELECT
        count(*) FILTER (WHERE i.location = 'OPERASI') AS operasi,
        count(*) FILTER (WHERE i.location = 'CSSD') AS cssd,
        count(*) FILTER (WHERE i.damaged_quantity > 0 OR EXISTS (
          SELECT 1 FROM item_contents c WHERE c.item_id = i.id AND c.damaged_quantity > 0
        )) AS damaged
      FROM items i
      WHERE NOT i.is_archived
    `),
    dueSoonItemIds(now),
  ]);
  const row = counts[0];
  return {
    operasi: Number(row?.operasi ?? 0),
    cssd: Number(row?.cssd ?? 0),
    damaged: Number(row?.damaged ?? 0),
    dueSoon: dueSoon.length,
  };
}

/** Active items with the most recent log entry, newest first, with damage flag. */
export async function listRecentItems(limit = RECENT_ITEMS) {
  const groups = await db.itemLog.groupBy({
    by: ["itemId"],
    where: { item: { isArchived: false } },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: "desc" } },
    take: limit,
  });
  if (groups.length === 0) return [];
  const items = await db.item.findMany({
    where: { id: { in: groups.map((g) => g.itemId) } },
    select: {
      id: true,
      code: true,
      name: true,
      location: true,
      locationSince: true,
      needsSterilization: true,
      damagedQuantity: true,
      contents: { where: { damagedQuantity: { gt: 0 } }, select: { id: true }, take: 1 },
    },
  });
  const byId = new Map(items.map((i) => [i.id, i]));
  return groups.flatMap((g) => {
    const item = byId.get(g.itemId);
    if (!item) return [];
    const { contents, ...rest } = item;
    return [{ ...rest, hasDamage: item.damagedQuantity > 0 || contents.length > 0 }];
  });
}

/** The latest log entries across all items, for the "Aktivitas terbaru" timeline. */
export function listRecentActivity(limit = RECENT_ACTIVITY) {
  return db.itemLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      actorName: true,
      note: true,
      changes: true,
      createdAt: true,
      item: { select: { code: true, name: true } },
    },
  });
}

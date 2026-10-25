import { db } from "@/server/db";
import { type Cell, dateCell, toCsv } from "@/server/export/csv";
import { buildItemQuery, type ItemFilters } from "@/server/services/item.service";

const yesNo = (v: boolean) => (v ? "ya" : "tidak");

/** Earliest upcoming maintenance/calibration date per item (same rule as the item page). */
async function nextDueByItem(itemIds: string[]): Promise<Map<string, Date>> {
  const records = await db.maintenanceRecord.findMany({
    where: { itemId: { in: itemIds }, type: { in: ["PEMELIHARAAN", "KALIBRASI"] } },
    orderBy: [{ performedOn: "desc" }, { createdAt: "desc" }],
    select: { itemId: true, type: true, nextDue: true },
  });
  const seen = new Set<string>();
  const result = new Map<string, Date>();
  for (const r of records) {
    const key = `${r.itemId}|${r.type}`;
    if (seen.has(key)) continue; // only the latest record of each type counts
    seen.add(key);
    const current = result.get(r.itemId);
    if (r.nextDue && (!current || r.nextDue < current)) result.set(r.itemId, r.nextDue);
  }
  return result;
}

/** One row per item matching the list filters, with no row limit. Columns follow docs/14. */
export async function exportItemsCsv(filters: ItemFilters): Promise<string> {
  const { where, orderBy } = await buildItemQuery(filters);
  const items = await db.item.findMany({ where, orderBy });
  const due = await nextDueByItem(items.map((i) => i.id));

  const rows: Cell[][] = items.map((i) => [
    i.code,
    i.name,
    i.room,
    i.location === "CSSD" ? "CSSD" : "Operasi",
    yesNo(i.needsSterilization),
    i.quantity,
    i.damagedQuantity,
    i.quantity - i.damagedQuantity,
    i.brand,
    i.model,
    i.serialNumber,
    dateCell(i.purchaseDate),
    i.purchasePrice === null ? null : Number(i.purchasePrice),
    i.supplier,
    i.fundingSource,
    dateCell(i.warrantyUntil),
    dateCell(due.get(i.id)),
    i.description,
    yesNo(i.isArchived),
  ]);
  return toCsv(
    [
      "code",
      "name",
      "room",
      "location",
      "needs_sterilization",
      "quantity",
      "damaged_quantity",
      "good_quantity",
      "brand",
      "model",
      "serial_number",
      "purchase_date",
      "purchase_price",
      "supplier",
      "funding_source",
      "warranty_until",
      "next_due",
      "description",
      "archived",
    ],
    rows,
  );
}

/** One row per content line of the items matching the list filters, keyed by the item code. */
export async function exportContentsCsv(filters: ItemFilters): Promise<string> {
  const { where, orderBy } = await buildItemQuery(filters);
  const items = await db.item.findMany({
    where,
    orderBy,
    select: {
      code: true,
      name: true,
      contents: { orderBy: { name: "asc" } },
    },
  });
  const rows: Cell[][] = items.flatMap((i) =>
    i.contents.map((c) => [
      i.code,
      i.name,
      c.name,
      c.brand,
      c.quantity,
      c.damagedQuantity,
      c.quantity - c.damagedQuantity,
      c.note,
    ]),
  );
  return toCsv(
    [
      "item_code",
      "item_name",
      "name",
      "brand",
      "quantity",
      "damaged_quantity",
      "good_quantity",
      "note",
    ],
    rows,
  );
}

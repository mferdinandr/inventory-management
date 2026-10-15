import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { listItems } from "@/server/services/item.service";
import {
  dueSoonItemIds,
  getSummary,
  listRecentActivity,
  listRecentItems,
} from "@/server/services/summary.service";

// Fixed "now" (12:00 Jakarta) so the 30-day boundary is deterministic: cutoff is 2026-11-14.
const NOW = new Date("2026-10-15T05:00:00Z");

/** History tables refuse DELETE/TRUNCATE; switch their triggers off for the reset only. */
async function resetDatabase() {
  await db.$transaction([
    db.$executeRawUnsafe("ALTER TABLE item_logs DISABLE TRIGGER USER"),
    db.$executeRawUnsafe("ALTER TABLE maintenance_records DISABLE TRIGGER USER"),
    db.$executeRawUnsafe(
      "TRUNCATE item_logs, maintenance_records, item_contents, items, users CASCADE",
    ),
    db.$executeRawUnsafe("ALTER TABLE item_logs ENABLE TRIGGER USER"),
    db.$executeRawUnsafe("ALTER TABLE maintenance_records ENABLE TRIGGER USER"),
  ]);
}

// Leave no rows behind: other test files assume they can delete users.
afterAll(resetDatabase);

let userId: string;

const makeItem = (data: Record<string, unknown> = {}) =>
  db.item.create({ data: { name: "Barang", needsSterilization: false, ...data } });

const record = (
  itemId: string,
  type: "PEMELIHARAAN" | "KALIBRASI" | "PERBAIKAN",
  performedOn: string,
  nextDue: string | null,
) =>
  db.maintenanceRecord.create({
    data: {
      itemId,
      type,
      performedOn: new Date(performedOn),
      performer: "Teknisi",
      details: {},
      nextDue: nextDue ? new Date(nextDue) : null,
      damagedAfter: 0,
      userId,
      actorName: "Tester",
    },
  });

beforeEach(async () => {
  await resetDatabase();
  const u = await db.user.create({
    data: { username: "tester", name: "Tester", role: "OPERASI", passwordHash: "x" },
  });
  userId = u.id;
});

describe("getSummary", () => {
  it("is all zeros with no items", async () => {
    expect(await getSummary(NOW)).toEqual({ operasi: 0, cssd: 0, damaged: 0, dueSoon: 0 });
  });

  it("counts by location and ignores archived items", async () => {
    await makeItem();
    await makeItem();
    await makeItem({ needsSterilization: true, location: "CSSD" });
    await makeItem({ isArchived: true, damagedQuantity: 1 });
    await makeItem({ isArchived: true, needsSterilization: true, location: "CSSD" });
    expect(await getSummary(NOW)).toEqual({ operasi: 2, cssd: 1, damaged: 0, dueSoon: 0 });
  });

  it("counts damaged by the item or by any content row, once per item", async () => {
    await makeItem({ quantity: 2, damagedQuantity: 1 });
    const viaContents = await makeItem();
    await db.itemContent.createMany({
      data: [
        { itemId: viaContents.id, name: "Jarum", quantity: 5, damagedQuantity: 1 },
        { itemId: viaContents.id, name: "Pisau", quantity: 5, damagedQuantity: 2 },
      ],
    });
    const clean = await makeItem();
    await db.itemContent.create({ data: { itemId: clean.id, name: "Gunting", quantity: 3 } });
    const archived = await makeItem({ isArchived: true });
    await db.itemContent.create({
      data: { itemId: archived.id, name: "X", quantity: 1, damagedQuantity: 1 },
    });
    expect((await getSummary(NOW)).damaged).toBe(2);
  });
});

describe("due soon", () => {
  it("includes exactly 30 days and overdue, excludes 31 days and unscheduled", async () => {
    const edge = await makeItem();
    const late = await makeItem();
    const overdue = await makeItem();
    const future = await makeItem();
    const none = await makeItem();
    await record(edge.id, "PEMELIHARAAN", "2026-05-14", "2026-11-14");
    await record(late.id, "PEMELIHARAAN", "2026-05-15", "2026-11-15");
    await record(overdue.id, "KALIBRASI", "2025-01-01", "2026-01-01");
    await record(future.id, "PEMELIHARAAN", "2026-10-01", "2027-04-01");
    await record(none.id, "PERBAIKAN", "2026-10-01", null);
    const ids = await dueSoonItemIds(NOW);
    expect(ids.sort()).toEqual([edge.id, overdue.id].sort());
    expect((await getSummary(NOW)).dueSoon).toBe(2);
  });

  it("only the latest record of each type counts", async () => {
    const renewed = await makeItem();
    // The old overdue schedule was replaced by a newer record far in the future.
    await record(renewed.id, "PEMELIHARAAN", "2026-01-01", "2026-02-01");
    await record(renewed.id, "PEMELIHARAAN", "2026-10-01", "2027-04-01");
    // A different type still counts on its own: its latest record is due soon.
    const mixed = await makeItem();
    await record(mixed.id, "PEMELIHARAAN", "2026-10-01", "2027-04-01");
    await record(mixed.id, "KALIBRASI", "2026-10-01", "2026-11-01");
    // The latest record has no next due, so the older dated one no longer applies.
    const cleared = await makeItem();
    await record(cleared.id, "KALIBRASI", "2026-01-01", "2026-11-01");
    await record(cleared.id, "KALIBRASI", "2026-10-01", null);
    expect(await dueSoonItemIds(NOW)).toEqual([mixed.id]);
  });

  it("ignores archived items", async () => {
    const a = await makeItem({ isArchived: true });
    await record(a.id, "KALIBRASI", "2025-01-01", "2026-01-01");
    expect((await getSummary(NOW)).dueSoon).toBe(0);
  });
});

describe("recent items and activity", () => {
  const log = (itemId: string, action: "EDIT" | "SEND", createdAt: string) =>
    db.$executeRawUnsafe(
      `INSERT INTO item_logs (item_id, action, user_id, actor_name, created_at)
       VALUES ($1::uuid, $2::"LogAction", $3::uuid, 'Tester', $4::timestamptz)`,
      itemId,
      action,
      userId,
      createdAt,
    );

  it("lists each active item once, most recently changed first, with a damage flag", async () => {
    const a = await makeItem({ name: "A" });
    const b = await makeItem({ name: "B", damagedQuantity: 1, quantity: 2 });
    const c = await makeItem({ name: "C", isArchived: true });
    await log(a.id, "EDIT", "2026-10-01T00:00:00Z");
    await log(b.id, "EDIT", "2026-10-02T00:00:00Z");
    await log(a.id, "SEND", "2026-10-03T00:00:00Z");
    await log(c.id, "EDIT", "2026-10-04T00:00:00Z");
    const recent = await listRecentItems();
    expect(recent.map((i) => i.name)).toEqual(["A", "B"]);
    expect(recent.map((i) => i.hasDamage)).toEqual([false, true]);
    expect(await listRecentItems(1)).toHaveLength(1);
  });

  it("lists the latest log entries across all items, newest first, capped", async () => {
    const a = await makeItem({ name: "A" });
    for (let i = 1; i <= 22; i++) {
      await log(a.id, "EDIT", `2026-10-${String(i).padStart(2, "0")}T00:00:00Z`);
    }
    const activity = await listRecentActivity();
    expect(activity).toHaveLength(20);
    expect(activity[0]?.createdAt.toISOString()).toBe("2026-10-22T00:00:00.000Z");
    expect(activity[0]?.item.name).toBe("A");
  });
});

describe("listItems filters used by the Beranda cards", () => {
  it("dueSoon lists only items due within 30 days", async () => {
    const due = await makeItem({ name: "Jatuh tempo" });
    const later = await makeItem({ name: "Nanti" });
    await record(due.id, "KALIBRASI", "2020-01-01", "2020-06-01");
    await record(later.id, "KALIBRASI", "2020-01-01", "2099-01-01");
    expect((await listItems({ dueSoon: true })).map((i) => i.name)).toEqual(["Jatuh tempo"]);
    expect(await listItems()).toHaveLength(2);
  });

  it("damaged also matches items with a damaged content row", async () => {
    const viaContents = await makeItem({ name: "Set" });
    await db.itemContent.create({
      data: { itemId: viaContents.id, name: "Jarum", quantity: 2, damagedQuantity: 1 },
    });
    await makeItem({ name: "Utuh" });
    expect((await listItems({ damaged: true })).map((i) => i.name)).toEqual(["Set"]);
  });
});

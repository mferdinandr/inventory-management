import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Role } from "@/lib/permissions";
import type { MaintenanceInput } from "@/lib/validators/maintenance";
import { db } from "@/server/db";
import {
  createMaintenance,
  getNextDue,
  listMaintenance,
} from "@/server/services/maintenance.service";
import { createUser } from "@/server/services/user.service";

const common = {
  actorName: "Andi",
  performedOn: "2026-10-12",
  performer: "Teknisi Skytron",
  damagedAfter: 0,
};

const perbaikan = {
  ...common,
  type: "PERBAIKAN",
  details: {
    complaint: "Oli bocor",
    action: "Ganti seal",
    parts: "Seal kit",
    finishedOn: "2026-10-13",
  },
} satisfies MaintenanceInput;

const pemeliharaan = {
  ...common,
  type: "PEMELIHARAAN",
  nextDue: "2027-04-12",
  details: { activities: "Cek tegangan", findings: "Normal" },
} satisfies MaintenanceInput;

const kalibrasi = {
  ...common,
  type: "KALIBRASI",
  details: { institution: "BPFK", certificateNo: "C-1", result: "LULUS", validUntil: "2027-10-12" },
} satisfies MaintenanceInput;

let actor: { id: string; role: Role };
let item: { id: string; code: string };

async function makeActor(role: Role = "OPERASI") {
  const u = await createUser({
    username: `u-${role.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}`,
    name: "Tester",
    role,
    password: "password-123",
  });
  return { id: u.id, role };
}

/**
 * History tables refuse DELETE and TRUNCATE (that is the point), so the test database is
 * emptied with their triggers switched off for the duration of the reset only.
 */
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

beforeEach(async () => {
  await resetDatabase();
  actor = await makeActor();
  item = await db.item.create({
    data: { name: "Mesin Anestesi", needsSterilization: false, quantity: 3 },
    select: { id: true, code: true },
  });
});

describe("createMaintenance", () => {
  it("records a repair with its details shape and no next due", async () => {
    const rec = await createMaintenance(actor, item.code, { ...perbaikan, cost: 1500000 });
    expect(rec.type).toBe("PERBAIKAN");
    expect(rec.details).toEqual({
      complaint: "Oli bocor",
      action: "Ganti seal",
      parts: "Seal kit",
      finished_on: "2026-10-13",
    });
    expect(rec.nextDue).toBeNull();
    expect(rec.cost).toBe(BigInt(1500000));
    expect(rec.userId).toBe(actor.id);
    expect(rec.actorName).toBe("Andi");
  });

  it("takes next due from the routine-maintenance schedule", async () => {
    const rec = await createMaintenance(actor, item.id, pemeliharaan);
    expect(rec.details).toEqual({ activities: "Cek tegangan", findings: "Normal" });
    expect(rec.nextDue?.toISOString().slice(0, 10)).toBe("2027-04-12");
  });

  it("takes next due from the calibration validity", async () => {
    const rec = await createMaintenance(actor, item.code, kalibrasi);
    expect(rec.details).toEqual({
      institution: "BPFK",
      certificate_no: "C-1",
      result: "LULUS",
      valid_until: "2027-10-12",
    });
    expect(rec.nextDue?.toISOString().slice(0, 10)).toBe("2027-10-12");
  });

  it("updates the damaged count and logs it with the maintenance id", async () => {
    const rec = await createMaintenance(actor, item.code, { ...perbaikan, damagedAfter: 2 });
    const row = await db.item.findUniqueOrThrow({ where: { id: item.id } });
    expect(row.damagedQuantity).toBe(2);

    const log = await db.itemLog.findFirstOrThrow({ where: { itemId: item.id } });
    expect(log.action).toBe("MAINTENANCE");
    expect(log.maintenanceId).toBe(rec.id);
    expect(log.actorName).toBe("Andi");
    expect(log.userId).toBe(actor.id);
    expect(log.changes).toEqual([
      { name: "Mesin Anestesi", field: "damaged_quantity", from: 0, to: 2 },
    ]);
  });

  it("rejects more damaged units than the item has, writing nothing", async () => {
    await expect(
      createMaintenance(actor, item.code, { ...perbaikan, damagedAfter: 4 }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await db.maintenanceRecord.count()).toBe(0);
    expect(await db.itemLog.count()).toBe(0);
  });

  it("raises damaged to 1 for a failed calibration, but not above what was reported", async () => {
    const failed = {
      ...kalibrasi,
      details: { ...kalibrasi.details, result: "TIDAK_LULUS" },
    } as const;
    const rec = await createMaintenance(actor, item.code, failed);
    expect(rec.damagedAfter).toBe(1);
    expect((await db.item.findUniqueOrThrow({ where: { id: item.id } })).damagedQuantity).toBe(1);

    const again = await createMaintenance(actor, item.code, { ...failed, damagedAfter: 2 });
    expect(again.damagedAfter).toBe(2);
  });

  it("requires the fields of each form", async () => {
    const bad = [
      { ...perbaikan, details: { ...perbaikan.details, complaint: " " } },
      { ...pemeliharaan, details: { activities: "" } },
      { ...kalibrasi, details: { ...kalibrasi.details, institution: "" } },
      { ...perbaikan, performer: "" },
      { ...perbaikan, actorName: "" },
    ] as MaintenanceInput[];
    for (const input of bad) {
      await expect(createMaintenance(actor, item.code, input)).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
    }
  });

  it("rejects a calibration valid until before it was performed", async () => {
    await expect(
      createMaintenance(actor, item.code, {
        ...kalibrasi,
        details: { ...kalibrasi.details, validUntil: "2026-10-11" },
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("reports unknown and archived items", async () => {
    await expect(createMaintenance(actor, "BRG-9999", perbaikan)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await db.item.update({ where: { id: item.id }, data: { isArchived: true } });
    await expect(createMaintenance(actor, item.code, perbaikan)).rejects.toMatchObject({
      code: "STATE_CONFLICT",
    });
  });

  it.each(["OPERASI", "STERIL", "ALKES", "SUPERADMIN"] as const)("allows %s", async (role) => {
    const who = await makeActor(role);
    const rec = await createMaintenance(who, item.code, perbaikan);
    expect(rec.userId).toBe(who.id);
  });

  it("works on an item that is at CSSD", async () => {
    await db.item.update({
      where: { id: item.id },
      data: { needsSterilization: true, location: "CSSD" },
    });
    await expect(createMaintenance(actor, item.code, perbaikan)).resolves.toBeTruthy();
  });
});

describe("listMaintenance and getNextDue", () => {
  it("lists newest first and pages with a cursor", async () => {
    for (let day = 1; day <= 22; day++) {
      await createMaintenance(actor, item.code, {
        ...perbaikan,
        performedOn: `2026-09-${String(day).padStart(2, "0")}`,
      });
    }
    const first = await listMaintenance(item.id);
    expect(first.records).toHaveLength(20);
    expect(first.records[0]?.performedOn.toISOString().slice(0, 10)).toBe("2026-09-22");
    expect(first.nextCursor).not.toBeNull();

    const second = await listMaintenance(item.id, first.nextCursor ?? undefined);
    expect(second.records).toHaveLength(2);
    expect(second.nextCursor).toBeNull();
  });

  it("uses the latest schedule of each recurring kind, earliest wins", async () => {
    expect(await getNextDue(item.id)).toBeNull();
    await createMaintenance(actor, item.code, { ...pemeliharaan, nextDue: "2027-01-01" });
    await createMaintenance(actor, item.code, kalibrasi);
    expect((await getNextDue(item.id))?.toISOString().slice(0, 10)).toBe("2027-01-01");

    // A newer maintenance replaces the older schedule.
    await createMaintenance(actor, item.code, {
      ...pemeliharaan,
      performedOn: "2026-12-01",
      nextDue: "2028-01-01",
    });
    expect((await getNextDue(item.id))?.toISOString().slice(0, 10)).toBe("2027-10-12");
  });
});

describe("append-only", () => {
  it("blocks UPDATE and DELETE on maintenance_records", async () => {
    await createMaintenance(actor, item.code, perbaikan);
    await expect(
      db.$executeRawUnsafe("UPDATE maintenance_records SET performer = 'x'"),
    ).rejects.toThrow();
    await expect(db.$executeRawUnsafe("DELETE FROM maintenance_records")).rejects.toThrow();
    expect(await db.maintenanceRecord.count()).toBe(1);
  });
});

// Leave no history rows behind, or other test files could not clear their users.
afterAll(resetDatabase);

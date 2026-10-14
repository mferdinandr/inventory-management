import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Location, Role } from "@/lib/permissions";
import { db } from "@/server/db";
import {
  type Actor,
  archiveItem,
  getItemByCode,
  listItems,
  planContents,
  registerItem,
  restoreItem,
  updateItem,
} from "@/server/services/item.service";
import { createUser } from "@/server/services/user.service";

/** History tables are append-only by trigger, so cleanup switches the triggers off briefly. */
async function wipe() {
  await db.$transaction([
    db.$executeRawUnsafe('ALTER TABLE "item_logs" DISABLE TRIGGER USER'),
    db.$executeRawUnsafe('ALTER TABLE "maintenance_records" DISABLE TRIGGER USER'),
    db.itemLog.deleteMany(),
    db.maintenanceRecord.deleteMany(),
    db.itemContent.deleteMany(),
    db.item.deleteMany(),
    db.user.deleteMany(),
    db.$executeRawUnsafe('ALTER TABLE "item_logs" ENABLE TRIGGER USER'),
    db.$executeRawUnsafe('ALTER TABLE "maintenance_records" ENABLE TRIGGER USER'),
  ]);
}

const actors = {} as Record<Role, Actor>;

beforeEach(async () => {
  await wipe();
  for (const role of ["OPERASI", "STERIL", "ALKES", "SUPERADMIN"] as Role[]) {
    const u = await createUser({
      username: role.toLowerCase(),
      name: `Petugas ${role}`,
      role,
      password: "password-123",
    });
    actors[role] = { id: u.id, name: u.name, role };
  }
});

afterAll(wipe);

const op = () => actors.OPERASI;

/** Register a sterilizable container; move it to CSSD directly (the flow is M3's job). */
async function register(
  input: Parameters<typeof registerItem>[1] = { name: "MAYOR 1", needsSterilization: true },
) {
  return (await registerItem(op(), input)).item;
}
const moveTo = (id: string, location: Location) =>
  db.item.update({ where: { id }, data: { location, version: { increment: 1 } } });

const row = (name: string, quantity: number, extra = {}) => ({ name, quantity, ...extra });

describe("registerItem", () => {
  it("creates the item, its contents and a REGISTER log together", async () => {
    const { item, warnings } = await registerItem(op(), {
      name: "MAYOR 1",
      needsSterilization: true,
      room: "Kamar Operasi 101",
      contents: [row("DOEK KLEM", 4, { brand: "AESCULAP" }), row("Blade MAC 3", 2)],
    });
    expect(item.code).toMatch(/^BRG-\d{4}$/);
    expect(item.location).toBe("OPERASI");
    expect(item.quantity).toBe(1);
    expect(item.version).toBe(1);
    expect(warnings).toEqual([]);

    const detail = await getItemByCode(item.code);
    expect(detail?.contents.map((c) => c.name)).toEqual(["Blade MAC 3", "DOEK KLEM"]);
    expect(detail?.logs).toHaveLength(1);
    expect(detail?.logs[0]).toMatchObject({
      action: "REGISTER",
      actorName: "Petugas OPERASI",
      userId: op().id,
    });
  });

  it("writes nothing when the contents are invalid", async () => {
    await expect(
      registerItem(op(), {
        name: "X",
        needsSterilization: true,
        contents: [row("A", 1), row("a", 2)],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await db.item.count()).toBe(0);
    expect(await db.itemLog.count()).toBe(0);
  });

  it("requires only a name and the sterilization flag", async () => {
    await expect(registerItem(op(), { name: "", needsSterilization: false })).rejects.toMatchObject(
      { code: "VALIDATION_ERROR" },
    );
    await expect(registerItem(op(), { name: "Meja" } as never)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    await expect(
      registerItem(op(), { name: "Meja", needsSterilization: false }),
    ).resolves.toBeTruthy();
  });

  it("allows a serial number only when quantity is 1", async () => {
    await expect(
      registerItem(op(), {
        name: "USG",
        needsSterilization: false,
        quantity: 2,
        serialNumber: "S1",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const { item } = await registerItem(op(), {
      name: "USG",
      needsSterilization: false,
      serialNumber: "S1",
    });
    expect(item.serialNumber).toBe("S1");
    // A group without serial numbers may have any quantity.
    await expect(
      registerItem(op(), { name: "Meja Stainless", needsSterilization: false, quantity: 4 }),
    ).resolves.toBeTruthy();
  });

  it("keeps damaged quantity within 0..quantity, also for contents", async () => {
    const bad = (extra: object) =>
      registerItem(op(), { name: "X", needsSterilization: true, ...extra });
    await expect(bad({ quantity: 2, damagedQuantity: 3 })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    await expect(bad({ damagedQuantity: -1 })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(bad({ contents: [row("A", 2, { damagedQuantity: 3 })] })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    await expect(bad({ contents: [row("A", -1)] })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    await expect(bad({ quantity: 2, damagedQuantity: 2 })).resolves.toBeTruthy();
  });

  it("warns about a duplicate serial number but still registers", async () => {
    const first = await registerItem(op(), {
      name: "USG 1",
      needsSterilization: false,
      serialNumber: "SN-9",
    });
    expect(first.warnings).toEqual([]);
    const second = await registerItem(op(), {
      name: "USG 2",
      needsSterilization: false,
      serialNumber: "SN-9",
    });
    expect(second.warnings).toEqual([{ code: "DUPLICATE_SERIAL", codes: [first.item.code] }]);
    expect((await getItemByCode(second.item.code))?.duplicateSerialCodes).toEqual([
      first.item.code,
    ]);
  });

  it("is limited to OPERASI and SUPERADMIN", async () => {
    for (const role of ["STERIL", "ALKES"] as Role[]) {
      await expect(
        registerItem(actors[role], { name: "X", needsSterilization: true }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    await expect(
      registerItem(actors.SUPERADMIN, { name: "X", needsSterilization: true }),
    ).resolves.toBeTruthy();
  });
});

describe("updateItem", () => {
  it("edits fields, bumps the version and logs the field diff", async () => {
    const item = await register({ name: "MAYOR 1", needsSterilization: true, room: "RR" });
    const { item: updated } = await updateItem(op(), item.id, {
      version: item.version,
      room: "Kamar Operasi 102",
      brand: "Drager",
      purchasePrice: 1000,
      purchaseDate: "2024-03-01",
      note: "pindah kamar",
    });
    expect(updated.version).toBe(item.version + 1);
    expect(updated.room).toBe("Kamar Operasi 102");
    expect(updated.purchasePrice).toBe(BigInt(1000));

    const [log] = (await getItemByCode(item.code))?.logs ?? [];
    expect(log).toMatchObject({
      action: "EDIT",
      actorName: "Petugas OPERASI",
      note: "pindah kamar",
    });
    expect(log?.changes).toEqual([
      { name: "MAYOR 1", field: "room", from: "RR", to: "Kamar Operasi 102" },
      { name: "MAYOR 1", field: "brand", from: null, to: "Drager" },
      { name: "MAYOR 1", field: "purchase_date", from: null, to: "2024-03-01" },
      { name: "MAYOR 1", field: "purchase_price", from: null, to: 1000 },
    ]);
  });

  it("clears an optional field with an empty string", async () => {
    const item = await register({ name: "A", needsSterilization: true, room: "RR" });
    const { item: updated } = await updateItem(op(), item.id, { version: 1, room: "" });
    expect(updated.room).toBeNull();
  });

  it("does nothing, and logs nothing, when nothing differs", async () => {
    const item = await register({ name: "A", needsSterilization: true, room: "RR" });
    const { item: same } = await updateItem(op(), item.id, { version: 1, name: "A", room: "RR" });
    expect(same.version).toBe(1);
    expect(await db.itemLog.count({ where: { action: "EDIT" } })).toBe(0);
  });

  it("rejects a stale version and leaves the data alone", async () => {
    const item = await register();
    await updateItem(op(), item.id, { version: 1, room: "A" });
    await expect(updateItem(op(), item.id, { version: 1, room: "B" })).rejects.toMatchObject({
      code: "VERSION_CONFLICT",
    });
    expect((await db.item.findUniqueOrThrow({ where: { id: item.id } })).room).toBe("A");
  });

  it("lets only one of two concurrent saves win", async () => {
    const item = await register();
    const results = await Promise.allSettled([
      updateItem(op(), item.id, { version: 1, room: "A" }),
      updateItem(op(), item.id, { version: 1, room: "B" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const lost = results.find((r) => r.status === "rejected");
    expect(lost).toMatchObject({ reason: { code: "VERSION_CONFLICT" } });
    expect(await db.itemLog.count({ where: { action: "EDIT" } })).toBe(1);
  });

  it("re-checks the serial and damaged rules against stored values", async () => {
    const item = await register({ name: "USG", needsSterilization: true, serialNumber: "S1" });
    await expect(updateItem(op(), item.id, { version: 1, quantity: 2 })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    await expect(
      updateItem(op(), item.id, { version: 1, damagedQuantity: 2 }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    await expect(
      updateItem(op(), item.id, { version: 1, quantity: 2, serialNumber: "" }),
    ).resolves.toBeTruthy();
  });

  it("only changes needsSterilization while the item is at OPERASI", async () => {
    const item = await register();
    await moveTo(item.id, "CSSD");
    await expect(
      updateItem(actors.SUPERADMIN, item.id, { version: 2, needsSterilization: false }),
    ).rejects.toMatchObject({ code: "STATE_CONFLICT" });
    await moveTo(item.id, "OPERASI");
    const { item: updated } = await updateItem(op(), item.id, {
      version: 3,
      needsSterilization: false,
    });
    expect(updated.needsSterilization).toBe(false);
  });

  it("refuses edits to an archived item", async () => {
    const item = await register();
    const archived = await archiveItem(op(), item.id);
    await expect(
      updateItem(op(), item.id, { version: archived.version, room: "X" }),
    ).rejects.toMatchObject({ code: "STATE_CONFLICT" });
  });

  describe("role x location", () => {
    const edits = { details: { room: "Baru" }, contents: { contents: [row("Jarum", 5)] } };

    async function setup(location: Location) {
      const item = await register({
        name: "Set",
        needsSterilization: true,
        contents: [row("Jarum", 10)],
      });
      const placed = await moveTo(item.id, location);
      const jarum = await db.itemContent.findFirstOrThrow({ where: { itemId: item.id } });
      return { id: item.id, version: placed.version, jarumId: jarum.id };
    }

    // [role, location, may edit details, may edit contents]
    const matrix: [Role, Location, boolean, boolean][] = [
      ["OPERASI", "OPERASI", true, true],
      ["OPERASI", "CSSD", false, false],
      ["STERIL", "OPERASI", false, false],
      ["STERIL", "CSSD", false, true],
      ["ALKES", "OPERASI", false, false],
      ["ALKES", "CSSD", false, false],
      ["SUPERADMIN", "OPERASI", true, true],
      ["SUPERADMIN", "CSSD", true, true],
    ];

    it.each(matrix)(
      "%s at %s: details=%s contents=%s",
      async (role, location, details, contents) => {
        const s = await setup(location);
        const attempt = (extra: object) =>
          updateItem(actors[role], s.id, { version: s.version, ...extra });

        if (details) await expect(attempt(edits.details)).resolves.toBeTruthy();
        else await expect(attempt(edits.details)).rejects.toMatchObject({ code: "FORBIDDEN" });

        const current = (await db.item.findUniqueOrThrow({ where: { id: s.id } })).version;
        const second = () =>
          updateItem(actors[role], s.id, {
            version: current,
            contents: [{ id: s.jarumId, name: "Jarum", quantity: 5 }],
          });
        if (contents) await expect(second()).resolves.toBeTruthy();
        else await expect(second()).rejects.toMatchObject({ code: "FORBIDDEN" });
      },
    );

    it("lets STERIL add rows and change counts, but not delete or rename", async () => {
      const s = await setup("CSSD");
      const steril = actors.STERIL;
      await expect(
        updateItem(steril, s.id, {
          version: s.version,
          contents: [
            { id: s.jarumId, name: "Jarum", quantity: 9, damagedQuantity: 1, note: "oli bocor" },
            row("Pengganti", 1),
          ],
        }),
      ).resolves.toBeTruthy();
      const v = s.version + 1;
      await expect(
        updateItem(steril, s.id, { version: v, contents: [row("Pengganti", 1)] }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        updateItem(steril, s.id, {
          version: v,
          contents: [
            { id: s.jarumId, name: "Jarum 2", quantity: 9, damagedQuantity: 1, note: "oli bocor" },
            row("Pengganti", 1),
          ],
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });
});

describe("contents replace-all and log diff", () => {
  it("stores a per-field diff in item_logs.changes", async () => {
    const item = await register({
      name: "Set",
      needsSterilization: true,
      contents: [row("Jarum", 10), row("Gunting", 2), row("Klem", 1, { brand: "Storz" })],
    });
    const stored = await db.itemContent.findMany({ where: { itemId: item.id } });
    const id = (name: string) => stored.find((c) => c.name === name)?.id;

    await updateItem(op(), item.id, {
      version: 1,
      contents: [
        { id: id("Jarum"), name: "Jarum", quantity: 8, damagedQuantity: 1 },
        // Gunting is gone, Klem is renamed and loses its brand, Pisau is new.
        { id: id("Klem"), name: "Klem Besar", quantity: 1 },
        row("Pisau", 3),
      ],
    });

    const after = await db.itemContent.findMany({
      where: { itemId: item.id },
      orderBy: { name: "asc" },
    });
    expect(after.map((c) => [c.name, c.quantity, c.damagedQuantity])).toEqual([
      ["Jarum", 8, 1],
      ["Klem Besar", 1, 0],
      ["Pisau", 3, 0],
    ]);
    expect(after.find((c) => c.name === "Klem Besar")?.id).toBe(id("Klem"));

    const log = await db.itemLog.findFirstOrThrow({ where: { itemId: item.id, action: "EDIT" } });
    expect(log.changes).toEqual(
      expect.arrayContaining([
        { name: "Jarum", field: "quantity", from: 10, to: 8 },
        { name: "Jarum", field: "damaged_quantity", from: 0, to: 1 },
        { name: "Klem", field: "name", from: "Klem", to: "Klem Besar" },
        { name: "Klem", field: "brand", from: "Storz", to: null },
        { name: "Pisau", field: "quantity", from: null, to: 3 },
        { name: "Gunting", field: "quantity", from: 2, to: null },
      ]),
    );
    expect(log.changes).toHaveLength(6);
  });

  it("planContents matches by name when no id is given", () => {
    const stored = [
      { id: "1", name: "A", brand: null, quantity: 1, damagedQuantity: 0, note: null },
    ];
    const plan = planContents(stored, [
      { name: "A", brand: null, quantity: 2, damagedQuantity: 0, note: null },
    ]);
    expect(plan.creates).toEqual([]);
    expect(plan.deletes).toEqual([]);
    expect(plan.changes).toEqual([{ name: "A", field: "quantity", from: 1, to: 2 }]);
  });

  it("handles a few hundred rows in one save", async () => {
    const many = Array.from({ length: 300 }, (_, i) => row(`Alat ${i}`, i + 1));
    const item = await register({ name: "Set Besar", needsSterilization: true, contents: many });
    expect(await db.itemContent.count({ where: { itemId: item.id } })).toBe(300);
  });
});

describe("archive and restore", () => {
  it("hides the item from the default list, keeps it findable, and logs both", async () => {
    const item = await register();
    await archiveItem(op(), item.id, "dihapusbukukan");
    expect((await listItems()).map((i) => i.code)).not.toContain(item.code);
    expect((await listItems({ archived: true })).map((i) => i.code)).toContain(item.code);

    const restored = await restoreItem(op(), item.id);
    expect(restored.isArchived).toBe(false);
    expect((await listItems()).map((i) => i.code)).toContain(item.code);

    const logs = await db.itemLog.findMany({
      where: { itemId: item.id },
      orderBy: { createdAt: "asc" },
    });
    expect(logs.map((l) => l.action)).toEqual(["REGISTER", "ARCHIVE", "RESTORE"]);
    expect(logs[1]?.note).toBe("dihapusbukukan");
  });

  it("rejects repeating the same action", async () => {
    const item = await register();
    await expect(restoreItem(op(), item.id)).rejects.toMatchObject({ code: "STATE_CONFLICT" });
    await archiveItem(op(), item.id);
    await expect(archiveItem(op(), item.id)).rejects.toMatchObject({ code: "STATE_CONFLICT" });
  });

  it("follows the role x location rules", async () => {
    const item = await register();
    await expect(archiveItem(actors.STERIL, item.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(archiveItem(actors.ALKES, item.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await moveTo(item.id, "CSSD");
    await expect(archiveItem(op(), item.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(archiveItem(actors.SUPERADMIN, item.id)).resolves.toBeTruthy();
  });
});

describe("listItems", () => {
  it("filters by text over code, name, brand, serial and room, plus location and damage", async () => {
    const a = await register({
      name: "Mesin Anestesi",
      needsSterilization: false,
      brand: "Drager",
      room: "Kamar Operasi 101",
      serialNumber: "SN-77",
    });
    const b = await register({
      name: "MAYOR 1",
      needsSterilization: true,
      room: "RR",
      quantity: 3,
      damagedQuantity: 1,
    });
    await moveTo(b.id, "CSSD");

    const codes = async (f: Parameters<typeof listItems>[0]) =>
      (await listItems(f)).map((i) => i.code);
    expect(await codes({ q: "drager" })).toEqual([a.code]);
    expect(await codes({ q: "sn-77" })).toEqual([a.code]);
    expect(await codes({ q: "operasi 101" })).toEqual([a.code]);
    expect(await codes({ q: b.code.toLowerCase() })).toEqual([b.code]);
    expect(await codes({ q: "mayor" })).toEqual([b.code]);
    expect(await codes({ location: "CSSD" })).toEqual([b.code]);
    expect(await codes({ room: "RR" })).toEqual([b.code]);
    expect(await codes({ damaged: true })).toEqual([b.code]);
    expect(await codes({})).toEqual([a.code, b.code]);
  });
});

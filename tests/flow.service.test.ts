import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Role } from "@/lib/permissions";
import { db } from "@/server/db";
import { returnItem, sendItem } from "@/server/services/flow.service";
import { type Actor, registerItem } from "@/server/services/item.service";
import { createUser } from "@/server/services/user.service";
import { resetDatabase } from "./helpers/reset-db";

const actors = {} as Record<Role, Actor>;

beforeEach(async () => {
  await resetDatabase();
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

afterAll(resetDatabase);

const input = { actorName: "Sari", note: "" };

async function register(
  extra: Partial<Parameters<typeof registerItem>[1]> = {},
  location: "OPERASI" | "CSSD" = "OPERASI",
) {
  const { item } = await registerItem(actors.OPERASI, {
    name: "MAYOR 1",
    needsSterilization: true,
    contents: [
      { name: "Gunting", quantity: 4 },
      { name: "Pinset", quantity: 6 },
    ],
    ...extra,
  });
  if (location === "CSSD") {
    return db.item.update({
      where: { id: item.id },
      data: { location, version: { increment: 1 } },
    });
  }
  return item;
}

const reload = (id: string) => db.item.findUniqueOrThrow({ where: { id } });
const logs = (id: string, action: "SEND" | "RETURN") =>
  db.itemLog.findMany({ where: { itemId: id, action } });
const expectCode = (p: Promise<unknown>, code: string) => expect(p).rejects.toMatchObject({ code });

describe("sendItem", () => {
  it("moves the item to CSSD, bumps the version and writes a SEND log", async () => {
    const item = await register();
    const before = Date.now();
    const sent = await sendItem(actors.OPERASI, item.id, { actorName: "Sari", note: "pagi" });
    expect(sent.location).toBe("CSSD");
    expect(sent.version).toBe(item.version + 1);
    expect(sent.locationSince.getTime()).toBeGreaterThanOrEqual(before - 1000);
    const [log] = await logs(item.id, "SEND");
    expect(log).toMatchObject({ actorName: "Sari", note: "pagi", userId: actors.OPERASI.id });
  });

  it("rejects an item that needs no sterilization", async () => {
    const item = await register({ needsSterilization: false, contents: [] });
    await expectCode(sendItem(actors.OPERASI, item.id, input), "STATE_CONFLICT");
    expect((await reload(item.id)).location).toBe("OPERASI");
  });

  it("rejects an archived item", async () => {
    const item = await register();
    await db.item.update({ where: { id: item.id }, data: { isArchived: true } });
    await expectCode(sendItem(actors.OPERASI, item.id, input), "STATE_CONFLICT");
  });

  it("rejects a second send and names the actual location", async () => {
    const item = await register();
    await sendItem(actors.OPERASI, item.id, input);
    const err = await sendItem(actors.OPERASI, item.id, input).catch((e) => e);
    expect(err).toMatchObject({ code: "STATE_CONFLICT" });
    expect(err.message).toContain("CSSD");
    expect(await logs(item.id, "SEND")).toHaveLength(1);
  });

  it("requires an actor name", async () => {
    const item = await register();
    await expectCode(
      sendItem(actors.OPERASI, item.id, { actorName: " ", note: "" }),
      "VALIDATION_ERROR",
    );
  });

  it("answers NOT_FOUND for an unknown item", async () => {
    await expectCode(sendItem(actors.OPERASI, crypto.randomUUID(), input), "NOT_FOUND");
  });

  it("lets exactly one of two parallel sends win", async () => {
    const item = await register();
    const results = await Promise.allSettled([
      sendItem(actors.OPERASI, item.id, input),
      sendItem(actors.SUPERADMIN, item.id, input),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const lost = results.find((r) => r.status === "rejected");
    expect(lost).toMatchObject({ reason: { code: "STATE_CONFLICT" } });
    expect(await logs(item.id, "SEND")).toHaveLength(1);
    expect((await reload(item.id)).version).toBe(item.version + 1);
  });
});

describe("returnItem", () => {
  it("returns to Operasi, applies content changes and logs the diff", async () => {
    const item = await register({}, "CSSD");
    const stored = await db.itemContent.findMany({ where: { itemId: item.id } });
    const gunting = stored.find((c) => c.name === "Gunting");
    if (!gunting) throw new Error("fixture");

    const back = await returnItem(actors.STERIL, item.id, {
      version: item.version,
      actorName: "Budi",
      note: "1 gunting diganti",
      contents: [
        { id: gunting.id, quantity: 3, damagedQuantity: 1, note: "patah" },
        { name: "Klem pengganti", quantity: 1 },
      ],
    });
    expect(back.location).toBe("OPERASI");
    expect(back.version).toBe(item.version + 1);

    const rows = await db.itemContent.findMany({ where: { itemId: item.id } });
    expect(rows.find((c) => c.name === "Gunting")).toMatchObject({
      quantity: 3,
      damagedQuantity: 1,
      note: "patah",
    });
    expect(rows.find((c) => c.name === "Pinset")?.quantity).toBe(6);
    expect(rows.find((c) => c.name === "Klem pengganti")?.quantity).toBe(1);

    const [log, ...rest] = await logs(item.id, "RETURN");
    expect(rest).toHaveLength(0);
    expect(log).toMatchObject({ actorName: "Budi", note: "1 gunting diganti" });
    expect(log?.changes).toEqual(
      expect.arrayContaining([
        { name: "Gunting", field: "quantity", from: 4, to: 3 },
        { name: "Gunting", field: "damaged_quantity", from: 0, to: 1 },
        { name: "Gunting", field: "note", from: null, to: "patah" },
        { name: "Klem pengganti", field: "quantity", from: null, to: 1 },
      ]),
    );
  });

  it("returns without content changes and writes no diff", async () => {
    const item = await register({}, "CSSD");
    await returnItem(actors.STERIL, item.id, {
      version: item.version,
      actorName: "Budi",
      note: "",
    });
    const [log] = await logs(item.id, "RETURN");
    expect(log?.changes).toBeNull();
    expect((await reload(item.id)).location).toBe("OPERASI");
  });

  it("rejects a return from Operasi with the actual location", async () => {
    const item = await register();
    const err = await returnItem(actors.STERIL, item.id, {
      version: item.version,
      actorName: "Budi",
    }).catch((e) => e);
    expect(err).toMatchObject({ code: "STATE_CONFLICT" });
    expect(err.message).toContain("Operasi");
  });

  it("rejects an archived item", async () => {
    const item = await register({}, "CSSD");
    await db.item.update({ where: { id: item.id }, data: { isArchived: true } });
    await expectCode(
      returnItem(actors.STERIL, item.id, { version: item.version + 0, actorName: "Budi" }),
      "STATE_CONFLICT",
    );
  });

  it("rejects a stale version and changes nothing", async () => {
    const item = await register({}, "CSSD");
    await expectCode(
      returnItem(actors.STERIL, item.id, { version: item.version - 1, actorName: "Budi" }),
      "VERSION_CONFLICT",
    );
    expect((await reload(item.id)).location).toBe("CSSD");
    expect(await logs(item.id, "RETURN")).toHaveLength(0);
  });

  it("rejects invalid content values", async () => {
    const item = await register({}, "CSSD");
    const [row] = await db.itemContent.findMany({ where: { itemId: item.id } });
    await expectCode(
      returnItem(actors.STERIL, item.id, {
        version: item.version,
        actorName: "Budi",
        contents: [{ id: row?.id, damagedQuantity: 99 }],
      }),
      "VALIDATION_ERROR",
    );
    expect((await reload(item.id)).location).toBe("CSSD");
  });

  it("does not let steril staff rename rows", async () => {
    const item = await register({}, "CSSD");
    const [row] = await db.itemContent.findMany({ where: { itemId: item.id } });
    await expectCode(
      returnItem(actors.STERIL, item.id, {
        version: item.version,
        actorName: "Budi",
        contents: [{ id: row?.id, name: "Lain" }],
      }),
      "FORBIDDEN",
    );
    expect((await reload(item.id)).location).toBe("CSSD");
  });

  it("is atomic: a content write that fails leaves location, version and log untouched", async () => {
    const item = await register({}, "CSSD");
    const rows = await db.itemContent.findMany({
      where: { itemId: item.id },
      orderBy: { name: "asc" },
    });
    // Renaming one row to the other's name passes validation but violates UNIQUE(item_id, name).
    const [a, b] = rows;
    await expectCode(
      returnItem(actors.SUPERADMIN, item.id, {
        version: item.version,
        actorName: "Admin",
        contents: [{ id: a?.id, name: b?.name }],
      }),
      "VALIDATION_ERROR",
    );
    const after = await reload(item.id);
    expect(after.location).toBe("CSSD");
    expect(after.version).toBe(item.version);
    expect(await logs(item.id, "RETURN")).toHaveLength(0);
  });

  it("lets exactly one of two parallel returns win", async () => {
    const item = await register({}, "CSSD");
    const call = () =>
      returnItem(actors.STERIL, item.id, { version: item.version, actorName: "Budi" });
    const results = await Promise.allSettled([call(), call()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await logs(item.id, "RETURN")).toHaveLength(1);
  });
});

describe("role x location", () => {
  const roles: Role[] = ["OPERASI", "STERIL", "ALKES", "SUPERADMIN"];
  const canSend: Record<Role, boolean> = {
    OPERASI: true,
    STERIL: false,
    ALKES: false,
    SUPERADMIN: true,
  };
  const canReturn: Record<Role, boolean> = {
    OPERASI: false,
    STERIL: true,
    ALKES: false,
    SUPERADMIN: true,
  };

  for (const role of roles) {
    it(`${role}: send ${canSend[role] ? "allowed" : "forbidden"}`, async () => {
      const item = await register();
      const p = sendItem(actors[role], item.id, input);
      if (canSend[role]) await expect(p).resolves.toMatchObject({ location: "CSSD" });
      else {
        await expectCode(p, "FORBIDDEN");
        expect((await reload(item.id)).location).toBe("OPERASI");
      }
    });

    it(`${role}: return ${canReturn[role] ? "allowed" : "forbidden"}`, async () => {
      const item = await register({}, "CSSD");
      const p = returnItem(actors[role], item.id, { version: item.version, actorName: "X" });
      if (canReturn[role]) await expect(p).resolves.toMatchObject({ location: "OPERASI" });
      else {
        await expectCode(p, "FORBIDDEN");
        expect((await reload(item.id)).location).toBe("CSSD");
      }
    });
  }
});

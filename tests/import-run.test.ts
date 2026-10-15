import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { formatMapCsv, formatReport, hasErrors, runImport } from "@/server/import/run";
import { createUser } from "@/server/services/user.service";
import { resetDatabase } from "./helpers/reset-db";

let userId: string;

beforeEach(async () => {
  await resetDatabase();
  const u = await createUser({
    username: "admin",
    name: "Admin RS",
    role: "SUPERADMIN",
    password: "password-123",
  });
  userId = u.id;
});

afterAll(wipe);

const ITEMS_HEADER = "ref,name,needs_sterilization,room,quantity,damaged_quantity,serial_number\n";
const CONTENTS_HEADER = "ref,name,brand,quantity,damaged_quantity,note\n";

const items = (...rows: string[]) => ITEMS_HEADER + rows.join("\n");
const contents = (...rows: string[]) => CONTENTS_HEADER + rows.join("\n");
const run = (itemsText: string, contentsText = CONTENTS_HEADER, extra = {}) =>
  runImport({ itemsText, contentsText, username: "admin", ...extra });

const GOOD_ITEMS = items(
  "S1,MAYOR 1,ya,,1,0,",
  "M1,Mesin Anestesi Drager,tidak,Kamar 103,1,1,SN-1",
  "T1,Meja stainless,tidak,Kamar 101,4,0,",
);
const GOOD_CONTENTS = contents(
  "S1,DOEK KLEM,AESCULAP,5,1,ujung patah",
  "S1,PEAN,SMIC,10,0,",
  "S1,ARTERI BESAR,,2,0,",
);

describe("runImport", () => {
  it("imports items, contents and REGISTER logs", async () => {
    const report = await run(GOOD_ITEMS, GOOD_CONTENTS);
    expect(report.created).toBe(3);
    expect(report.contentsCreated).toBe(3);
    expect(hasErrors(report)).toBe(false);
    expect(report.map.map((m) => m.ref)).toEqual(["S1", "M1", "T1"]);
    expect(report.map.every((m) => /^BRG-\d{4}$/.test(m.code))).toBe(true);

    const set = await db.item.findFirstOrThrow({
      where: { name: "MAYOR 1" },
      include: { contents: true, logs: true },
    });
    expect(set.needsSterilization).toBe(true);
    expect(set.contents).toHaveLength(3);
    expect(set.contents.find((c) => c.name === "DOEK KLEM")).toMatchObject({
      brand: "AESCULAP",
      quantity: 5,
      damagedQuantity: 1,
      note: "ujung patah",
    });
    expect(set.logs).toHaveLength(1);
    expect(set.logs[0]).toMatchObject({
      action: "REGISTER",
      actorName: "Impor CSV",
      userId,
    });
    const machine = await db.item.findFirstOrThrow({ where: { serialNumber: "SN-1" } });
    expect(machine).toMatchObject({ quantity: 1, damagedQuantity: 1, room: "Kamar 103" });
    expect(formatMapCsv(report.map).split("\n")[0]).toBe("ref,code,status");
  });

  it("dry-run validates and reports but writes nothing", async () => {
    const report = await run(GOOD_ITEMS, GOOD_CONTENTS, { dryRun: true });
    expect(report.created).toBe(3);
    expect(report.contentsCreated).toBe(3);
    expect(await db.item.count()).toBe(0);
    expect(await db.itemLog.count()).toBe(0);
    expect(formatReport(report)).toContain("dry-run");
  });

  it("reports every invalid row with its row number and imports nothing", async () => {
    const report = await run(
      items(
        "A,Baik,ya,,1,0,",
        "B,Rusak berlebih,ya,,2,3,",
        "C,Seri banyak,tidak,,2,0,SN-9",
        "D,Tanggal,ya,,x,0,",
        ",Tanpa ref,ya,,1,0,",
        "A,Ref ganda,ya,,1,0,",
      ),
      contents("A,Alat,,1,0,", "Z,Yatim,,1,0,", "A,Alat2,,1,5,"),
    );
    expect(report.blocked).toBe(true);
    expect(await db.item.count()).toBe(0);
    const at = (file: string, row: number) =>
      report.issues.filter((i) => i.file === file && i.row === row).map((i) => i.message);
    expect(at("items", 3).join()).toMatch(/Jumlah rusak tidak boleh melebihi jumlah/);
    expect(at("items", 4).join()).toMatch(/Nomor seri hanya boleh diisi bila jumlah = 1/);
    expect(at("items", 5).join()).toMatch(/quantity: "x" bukan angka/);
    expect(at("items", 6).join()).toMatch(/ref wajib diisi/);
    expect(at("items", 7).join()).toMatch(/ganda/);
    expect(at("contents", 3).join()).toMatch(/tidak ditemukan di items\.csv/);
    expect(at("contents", 4).join()).toMatch(/damaged_quantity/);
    expect(formatReport(report)).toContain("Tidak ada yang diimpor");
  });

  it("--skip-invalid imports valid rows and still reports the rest", async () => {
    const report = await run(
      items("A,Baik,ya,,1,0,", "B,Rusak berlebih,ya,,2,3,"),
      contents("A,Alat,,1,0,", "B,Alat B,,1,0,"),
      { skipInvalid: true },
    );
    expect(report.blocked).toBe(false);
    expect(report.created).toBe(1);
    expect(report.skippedInvalid).toBe(1);
    expect(hasErrors(report)).toBe(true);
    expect(await db.item.findMany({ select: { name: true } })).toEqual([{ name: "Baik" }]);
    expect(await db.itemContent.count()).toBe(1);
  });

  it("rejects malformed headers before reading rows", async () => {
    const report = await runImport({
      itemsText: "ref,nama\nA,B",
      contentsText: CONTENTS_HEADER,
      username: "admin",
    });
    expect(report.blocked).toBe(true);
    expect(report.issues[0]?.message).toMatch(/Kolom wajib tidak ada/);
  });

  it("is idempotent: a second run skips existing (name, room) pairs", async () => {
    await run(GOOD_ITEMS, GOOD_CONTENTS);
    const again = await run(GOOD_ITEMS, GOOD_CONTENTS);
    expect(again.created).toBe(0);
    expect(again.skippedDuplicate).toHaveLength(3);
    expect(again.map.every((m) => m.status === "sudah ada" && m.code !== "")).toBe(true);
    expect(await db.item.count()).toBe(3);
    expect(await db.itemContent.count()).toBe(3);
    expect(await db.itemLog.count()).toBe(3);
  });

  it("treats the same name in another room as a different item, and repeats in one file as duplicates", async () => {
    const report = await run(
      items("A,Meja,tidak,Kamar 1,1,0,", "B,meja,tidak,kamar 1,1,0,", "C,Meja,tidak,Kamar 2,1,0,"),
    );
    expect(report.created).toBe(2);
    expect(report.skippedDuplicate.map((d) => d.ref)).toEqual(["B"]);
  });

  it("warns about duplicate serial numbers like the app does", async () => {
    await run(items("A,Monitor,tidak,,1,0,SN-7"));
    const report = await run(items("B,Monitor lain,tidak,,1,0,SN-7"));
    expect(report.created).toBe(1);
    expect(report.warnings.join()).toMatch(/SN-7/);

    const dry = await run(items("C,Monitor ketiga,tidak,,1,0,SN-7"), CONTENTS_HEADER, {
      dryRun: true,
    });
    expect(dry.warnings.join()).toMatch(/SN-7/);
  });

  it("writes each item atomically: a failure rolls that item back and the rest go on", async () => {
    // Fail the REGISTER log of one item at the database level.
    await db.$executeRawUnsafe(
      `
      CREATE OR REPLACE FUNCTION import_test_fail() RETURNS trigger AS $$
      BEGIN
        IF NEW.actor_name = 'Impor CSV' AND (SELECT name FROM items WHERE id = NEW.item_id) = 'GAGAL'
        THEN RAISE EXCEPTION 'simulated failure'; END IF;
        RETURN NEW;
      END $$ LANGUAGE plpgsql`,
    );
    await db.$executeRawUnsafe(
      "CREATE TRIGGER import_test_fail BEFORE INSERT ON item_logs FOR EACH ROW EXECUTE FUNCTION import_test_fail()",
    );
    try {
      const report = await run(
        items("A,Pertama,ya,,1,0,", "B,GAGAL,ya,,1,0,", "C,Ketiga,ya,,1,0,"),
        contents("A,Alat,,1,0,", "B,Alat,,1,0,", "C,Alat,,1,0,"),
      );
      expect(report.created).toBe(2);
      expect(report.issues.map((i) => i.row)).toEqual([3]);
      expect(report.issues[0]?.message).toMatch(/Gagal disimpan/);
      expect(await db.item.findMany({ orderBy: { name: "asc" }, select: { name: true } })).toEqual([
        { name: "Ketiga" },
        { name: "Pertama" },
      ]);
      expect(await db.itemContent.count()).toBe(2);
      expect(await db.itemLog.count()).toBe(2);
    } finally {
      await db.$executeRawUnsafe("DROP TRIGGER import_test_fail ON item_logs");
      await db.$executeRawUnsafe("DROP FUNCTION import_test_fail()");
    }
  });

  it("accepts semicolons, Excel dates, Rp prices and ya/tidak", async () => {
    const report = await runImport({
      itemsText:
        "﻿ref;name;needs_sterilization;purchase_date;purchase_price;warranty_until\n" +
        'A;"Lampu; Operasi";tidak;15/11/2025;"Rp 1.500.000";2027-01-31',
      contentsText: CONTENTS_HEADER,
      username: "admin",
    });
    expect(report.issues).toEqual([]);
    const item = await db.item.findFirstOrThrow({ where: { name: "Lampu; Operasi" } });
    expect(item.purchaseDate?.toISOString().slice(0, 10)).toBe("2025-11-15");
    expect(item.warrantyUntil?.toISOString().slice(0, 10)).toBe("2027-01-31");
    expect(item.purchasePrice).toBe(BigInt(1500000));
  });

  it("fails clearly for an unknown user", async () => {
    await expect(
      runImport({ itemsText: ITEMS_HEADER, contentsText: CONTENTS_HEADER, username: "nobody" }),
    ).rejects.toThrow(/tidak ditemukan/);
  });
});

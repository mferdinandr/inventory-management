import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { parseCsv } from "@/server/import/csv";
import { exportContentsCsv, exportItemsCsv } from "@/server/services/export.service";
import { type Actor, archiveItem, registerItem } from "@/server/services/item.service";
import { createUser } from "@/server/services/user.service";
import { resetDatabase } from "./helpers/reset-db";

let actor: Actor;

beforeEach(async () => {
  await resetDatabase();
  const u = await createUser({
    username: "operasi",
    name: "Petugas",
    role: "OPERASI",
    password: "password-123",
  });
  actor = { id: u.id, name: u.name, role: "OPERASI" };
});

afterAll(resetDatabase);

const header = (csv: string) => parseCsv(csv)[0] ?? [];
const records = (csv: string) => {
  const [head = [], ...rest] = parseCsv(csv);
  return rest.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
};

describe("exportItemsCsv", () => {
  it("exports every field of an item with ISO dates and a plain price", async () => {
    const { item } = await registerItem(actor, {
      name: "Mesin Anestesi",
      needsSterilization: false,
      room: "Kamar Operasi 101",
      quantity: 1,
      brand: "Drager",
      model: "Fabius",
      serialNumber: "SN-1",
      purchaseDate: "2024-05-06",
      purchasePrice: 1500000,
      supplier: "PT Medika",
      fundingSource: "APBD",
      warrantyUntil: "2027-05-06",
    });
    const [row] = records(await exportItemsCsv({}));
    expect(row).toMatchObject({
      code: item.code,
      name: "Mesin Anestesi",
      room: "Kamar Operasi 101",
      location: "Operasi",
      needs_sterilization: "tidak",
      quantity: "1",
      damaged_quantity: "0",
      good_quantity: "1",
      brand: "Drager",
      serial_number: "SN-1",
      purchase_date: "2024-05-06",
      purchase_price: "1500000",
      supplier: "PT Medika",
      warranty_until: "2027-05-06",
      archived: "tidak",
    });
  });

  it("applies the list filters and has no row limit", async () => {
    for (let i = 0; i < 3; i++) {
      await registerItem(actor, { name: `Set ${i}`, needsSterilization: true, room: "A" });
    }
    await registerItem(actor, { name: "Meja", needsSterilization: false, room: "B" });
    expect(records(await exportItemsCsv({})).length).toBe(4);
    expect(records(await exportItemsCsv({ room: "A" })).map((r) => r.name)).toEqual([
      "Set 0",
      "Set 1",
      "Set 2",
    ]);
    expect(records(await exportItemsCsv({ needsSterilization: true })).length).toBe(3);
    expect(records(await exportItemsCsv({ q: "meja" })).map((r) => r.name)).toEqual(["Meja"]);
  });

  it("keeps archived items out unless asked, and honours the sort", async () => {
    const { item } = await registerItem(actor, { name: "Lama", needsSterilization: false });
    await registerItem(actor, { name: "Baru", needsSterilization: false });
    await archiveItem(actor, item.id);
    expect(records(await exportItemsCsv({})).map((r) => r.name)).toEqual(["Baru"]);
    expect(records(await exportItemsCsv({ archived: true })).map((r) => r.name)).toEqual(["Lama"]);
    expect(records(await exportItemsCsv({ sort: "name", dir: "desc" }))[0]?.name).toBe("Baru");
  });

  it("returns only the header when nothing matches", async () => {
    const csv = await exportItemsCsv({ q: "tidak-ada" });
    expect(header(csv)[0]).toBe("code");
    expect(records(csv)).toEqual([]);
  });

  it("neutralises formulas typed into names", async () => {
    await registerItem(actor, { name: "=HYPERLINK(1)", needsSterilization: false });
    expect(records(await exportItemsCsv({}))[0]?.name).toBe("'=HYPERLINK(1)");
  });
});

describe("exportContentsCsv", () => {
  it("lists content lines keyed by the item code", async () => {
    const { item } = await registerItem(actor, {
      name: "MAYOR 1",
      needsSterilization: true,
      contents: [
        { name: "Doek klem", brand: "Aesculap", quantity: 4, damagedQuantity: 1, note: "karat" },
        { name: "Gunting", quantity: 2 },
      ],
    });
    await registerItem(actor, { name: "Meja", needsSterilization: false });
    const rows = records(await exportContentsCsv({}));
    expect(rows.map((r) => r.name)).toEqual(["Doek klem", "Gunting"]);
    expect(rows[0]).toMatchObject({
      item_code: item.code,
      item_name: "MAYOR 1",
      brand: "Aesculap",
      quantity: "4",
      damaged_quantity: "1",
      good_quantity: "3",
      note: "karat",
    });
  });
});

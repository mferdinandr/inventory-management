import { z } from "zod";

/** Optional free text: trimmed, and an empty string means "no value" (null). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter`)
    .transform((v) => (v === "" ? null : v))
    .nullish();

/** Optional calendar date as `YYYY-MM-DD` (what <input type="date"> sends); "" means null. */
const optionalDate = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const date = new Date(`${v}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: "custom", message: "Tanggal tidak valid" });
      return z.NEVER;
    }
    return date;
  })
  .nullish();

const count = (label: string) =>
  z.number({ error: `${label} harus berupa angka` }).int(`${label} harus bilangan bulat`);

const quantity = count("Jumlah").min(0, "Jumlah tidak boleh negatif");
const damagedQuantity = count("Jumlah rusak").min(0, "Jumlah rusak tidak boleh negatif");

/** One row of a container's contents (docs/02 F3). */
export const contentRowSchema = z
  .object({
    /** Present when the row already exists; lets a rename be told apart from remove + add. */
    id: z.string().optional(),
    name: z
      .string()
      .trim()
      .min(1, "Nama isi wajib diisi")
      .max(120, "Nama isi maksimal 120 karakter"),
    brand: optionalText(80),
    quantity,
    damagedQuantity: damagedQuantity.default(0),
    note: optionalText(300),
  })
  .refine((row) => row.damagedQuantity <= row.quantity, {
    message: "Jumlah rusak tidak boleh melebihi jumlah",
    path: ["damagedQuantity"],
  });

const contentsSchema = z.array(contentRowSchema).max(1000, "Terlalu banyak baris isi");

/** `UNIQUE (item_id, name)` in the database; say so before the insert fails. */
function duplicateContentName(rows: { name: string }[]): string | undefined {
  const seen = new Set<string>();
  for (const { name } of rows) {
    const key = name.toLowerCase();
    if (seen.has(key)) return name;
    seen.add(key);
  }
}

/** The fields that describe the item itself (everything except contents). */
const itemFields = {
  room: optionalText(120),
  description: optionalText(1000),
  brand: optionalText(80),
  model: optionalText(80),
  serialNumber: optionalText(80),
  purchaseDate: optionalDate,
  purchasePrice: count("Harga").min(0, "Harga tidak boleh negatif").nullish(),
  supplier: optionalText(120),
  fundingSource: optionalText(120),
  warrantyUntil: optionalDate,
};

/**
 * Rules that span several fields (docs/02 F2). Shared by registration and by updates, where
 * they apply to the merged result of stored values and the submitted ones.
 */
export function itemRuleError(v: {
  quantity: number;
  damagedQuantity: number;
  serialNumber?: string | null;
}): string | null {
  if (v.damagedQuantity > v.quantity) return "Jumlah rusak tidak boleh melebihi jumlah";
  if (v.serialNumber && v.quantity !== 1) {
    return "Nomor seri hanya boleh diisi bila jumlah = 1";
  }
  return null;
}

export const registerItemSchema = z
  .object({
    name: z.string().trim().min(1, "Nama wajib diisi").max(120, "Nama maksimal 120 karakter"),
    needsSterilization: z.boolean({ error: "Pilih apakah barang perlu sterilisasi" }),
    quantity: quantity.default(1),
    damagedQuantity: damagedQuantity.default(0),
    ...itemFields,
    contents: contentsSchema.default([]),
  })
  .superRefine((v, ctx) => {
    const rule = itemRuleError(v);
    if (rule) ctx.addIssue({ code: "custom", message: rule });
    const dupe = duplicateContentName(v.contents);
    if (dupe) ctx.addIssue({ code: "custom", message: `Nama isi ganda: ${dupe}` });
  });

/** Only the fields that are present change; `contents`, when present, replaces the whole list. */
export const updateItemSchema = z
  .object({
    version: z.number({ error: "Versi data wajib ada" }).int(),
    name: z
      .string()
      .trim()
      .min(1, "Nama wajib diisi")
      .max(120, "Nama maksimal 120 karakter")
      .optional(),
    needsSterilization: z.boolean().optional(),
    quantity: quantity.optional(),
    damagedQuantity: damagedQuantity.optional(),
    ...itemFields,
    contents: contentsSchema.optional(),
    note: optionalText(300),
  })
  .superRefine((v, ctx) => {
    const dupe = duplicateContentName(v.contents ?? []);
    if (dupe) ctx.addIssue({ code: "custom", message: `Nama isi ganda: ${dupe}` });
  });

export type ContentRowInput = z.input<typeof contentRowSchema>;
export type RegisterItemInput = z.input<typeof registerItemSchema>;
export type UpdateItemInput = z.input<typeof updateItemSchema>;

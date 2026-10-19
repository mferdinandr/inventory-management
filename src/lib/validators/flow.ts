import { z } from "zod";
import { contentRowSchema } from "./item";

const actorName = z
  .string({ error: "Nama petugas wajib diisi" })
  .trim()
  .min(1, "Nama petugas wajib diisi")
  .max(80, "Nama petugas maksimal 80 karakter");

const note = z
  .string()
  .trim()
  .max(300, "Maksimal 300 karakter")
  .transform((v) => (v === "" ? null : v))
  .nullish();

export const sendItemSchema = z.object({ actorName, note });

/**
 * A row changed on return. With an `id` only the given fields change; without one it is a
 * new row, which needs a name and a quantity.
 */
const returnContentSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  brand: z.string().nullish(),
  quantity: z.number().optional(),
  damagedQuantity: z.number().optional(),
  note: z.string().nullish(),
});

export const returnItemSchema = z.object({
  version: z.number({ error: "Versi data wajib ada" }).int(),
  actorName,
  note,
  contents: z.array(returnContentSchema).max(1000, "Terlalu banyak baris isi").optional(),
});

export { contentRowSchema };
export type SendItemInput = z.input<typeof sendItemSchema>;
export type ReturnItemInput = z.input<typeof returnItemSchema>;

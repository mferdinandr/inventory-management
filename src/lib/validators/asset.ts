import { z } from "zod"

// FR-06 (docs/02-prd.md): field wajib nama, kategori, lokasi, kondisi awal,
// tanggal perolehan; sisanya opsional.

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Terlalu panjang (maksimal ${max} karakter).`)
    .transform((v) => (v === "" ? null : v))
    .nullable()

const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .refine((v) => v === null || !Number.isNaN(Date.parse(v)), "Tanggal tidak valid.")
  .transform((v) => (v === null ? null : new Date(v)))

export const assetFormSchema = z.object({
  name: z.string().trim().min(1, "Nama aset wajib diisi.").max(200, "Nama terlalu panjang."),
  categoryId: z.string().uuid("Kategori wajib dipilih."),
  locationId: z.string().uuid("Ruangan wajib dipilih."),
  condition: z.enum(["GOOD", "MINOR_ISSUE", "NEEDS_REPAIR", "UNUSABLE"]),
  acquisitionDate: z
    .string()
    .trim()
    .min(1, "Tanggal perolehan wajib diisi.")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Tanggal tidak valid.")
    .transform((v) => new Date(v)),
  brand: optionalText(120),
  model: optionalText(120),
  serialNumber: optionalText(120),
  yearManufactured: z.coerce
    .number()
    .int()
    .min(1900)
    .max(2100)
    .nullable()
    .or(z.literal("").transform(() => null)),
  fundingSource: z
    .enum(["APBD", "APBN", "BLUD", "HIBAH", "KSO", "LAINNYA", ""])
    .transform((v) => (v === "" ? null : v)),
  acquisitionCost: z.coerce
    .number()
    .nonnegative("Nilai perolehan tidak boleh negatif.")
    .nullable()
    .or(z.literal("").transform(() => null)),
  acquisitionDocumentNo: optionalText(100),
  warrantyUntil: optionalDate,
  economicLifeYears: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .nullable()
    .or(z.literal("").transform(() => null)),
  notes: optionalText(2000),
  confirmDuplicateSerial: z.coerce.boolean().optional().default(false),
})

export type AssetFormInput = z.infer<typeof assetFormSchema>

export const assetIdSchema = z.object({ id: z.string().uuid("Aset tidak ditemukan.") })

export const printReasonSchema = z.object({
  assetId: z.string().uuid(),
  reason: z.enum(["FIRST_PRINT", "LABEL_DAMAGED", "LABEL_LOST", "LABEL_FADED", "RELOCATED"]),
  labelSize: z.enum(["50x30mm", "62x29mm", "A4_SHEET"]),
})

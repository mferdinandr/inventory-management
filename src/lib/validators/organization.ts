import { z } from "zod"
import { emailSchema } from "./auth"

// FR-01b / FR-01c (docs/02-prd.md). Kuota penyimpanan diisi dalam GB di formulir
// dan disimpan sebagai byte (kolom `quota_storage_bytes`).

export const GB = 1024 ** 3

export const ORGANIZATION_STATUSES = ["TRIAL", "ACTIVE", "SUSPENDED"] as const

export const TIMEZONES = ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"] as const

export const DEFAULT_QUOTA = {
  assets: Number(process.env.DEFAULT_QUOTA_ASSETS ?? 2000),
  storageGb: Number(process.env.DEFAULT_QUOTA_STORAGE_BYTES ?? 20 * GB) / GB,
  users: Number(process.env.DEFAULT_QUOTA_USERS ?? 50),
}

export const organizationIdSchema = z.object({
  id: z.uuid("Organisasi tidak valid."),
})

const quotaSchema = {
  status: z.enum(ORGANIZATION_STATUSES, { message: "Status tidak valid." }),
  quotaAssets: z.coerce
    .number({ message: "Kuota aset harus berupa angka." })
    .int("Kuota aset harus bilangan bulat.")
    .min(1, "Kuota aset minimal 1.")
    .max(1_000_000, "Kuota aset terlalu besar."),
  quotaStorageGb: z.coerce
    .number({ message: "Kuota penyimpanan harus berupa angka." })
    .int("Kuota penyimpanan harus bilangan bulat (GB).")
    .min(1, "Kuota penyimpanan minimal 1 GB.")
    .max(10_000, "Kuota penyimpanan terlalu besar."),
  quotaUsers: z.coerce
    .number({ message: "Kuota pengguna harus berupa angka." })
    .int("Kuota pengguna harus bilangan bulat.")
    .min(1, "Kuota pengguna minimal 1.")
    .max(10_000, "Kuota pengguna terlalu besar."),
}

// Narahubung pelanggan (docs/03-erd.md §3.1) — opsional; isian kosong disimpan NULL.
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} terlalu panjang.`)
    .optional()
    .transform((v) => v || null)

const contactSchema = {
  contactName: optionalText(200, "Nama narahubung"),
  contactEmail: z
    .union([z.literal(""), emailSchema])
    .optional()
    .transform((v) => v || null),
  contactPhone: optionalText(50, "Nomor telepon"),
}

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(1, "Nama organisasi wajib diisi.").max(200, "Nama terlalu panjang."),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Kode organisasi minimal 2 karakter.")
    .max(20, "Kode organisasi maksimal 20 karakter.")
    .regex(/^[A-Z0-9-]+$/, "Kode hanya boleh huruf, angka, dan tanda hubung."),
  timezone: z.enum(TIMEZONES, { message: "Zona waktu tidak valid." }),
  // Checkbox HTML: "on" bila dicentang, tidak terkirim bila tidak.
  showGovernmentFields: z
    .string()
    .optional()
    .transform((v) => v === "on"),
  ...quotaSchema,
  ...contactSchema,
  adminName: z.string().trim().min(1, "Nama admin wajib diisi.").max(200, "Nama terlalu panjang."),
  adminEmail: emailSchema,
})

export const updateOrganizationSchema = z.object({ ...quotaSchema, ...contactSchema })

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>

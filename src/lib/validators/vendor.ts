import { z } from "zod"

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Terlalu panjang (maksimal ${max} karakter).`)
    .transform((v) => (v === "" ? null : v))
    .nullable()

export const VENDOR_TYPES = ["SUPPLIER", "SERVICE", "CALIBRATION"] as const

export const vendorFormSchema = z.object({
  name: z.string().trim().min(1, "Nama vendor wajib diisi.").max(200, "Nama terlalu panjang."),
  type: z.array(z.enum(VENDOR_TYPES)).min(1, "Pilih minimal satu jenis vendor."),
  contactPerson: optionalText(150),
  phone: optionalText(30),
  email: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .refine((v) => v === null || z.email().safeParse(v).success, "Email tidak valid."),
  address: optionalText(500),
})

export type VendorFormInput = z.infer<typeof vendorFormSchema>

export const vendorIdSchema = z.object({ id: z.string().uuid("Vendor tidak ditemukan.") })

export const setVendorActiveSchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
})

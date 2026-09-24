import { z } from "zod"

export const locationTypeSchema = z.enum(["BUILDING", "FLOOR", "DEPARTMENT", "ROOM"])

export const locationNameSchema = z
  .string()
  .trim()
  .min(1, "Nama lokasi tidak boleh kosong.")
  .max(200, "Nama lokasi terlalu panjang (maksimal 200 karakter).")

const optionalUuid = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .pipe(z.union([z.string().uuid("ID tidak valid."), z.null()]))

const optionalCode = z
  .string()
  .trim()
  .max(20, "Kode lokasi maksimal 20 karakter.")
  .regex(/^[A-Za-z0-9_-]*$/, "Kode hanya boleh huruf, angka, garis bawah, atau tanda hubung.")
  .transform((value) => (value === "" ? null : value.toUpperCase()))

export const createLocationSchema = z
  .object({
    parentId: optionalUuid.nullable().optional(),
    type: locationTypeSchema,
    name: locationNameSchema,
    code: optionalCode.optional(),
    picUserId: optionalUuid.nullable().optional(),
  })
  .superRefine((data, ctx) => {
    // Konsistensi induk—jenis diperiksa menyeluruh di service karena butuh baris
    // induk di basis data; di sini hanya aturan akar (tanpa induk) yang kasat mata.

    if ((data.parentId === null || data.parentId === undefined) && data.type !== "BUILDING") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["type"],
        message: "Lokasi tanpa induk hanya boleh bertipe Gedung (BUILDING.).",
      })
    }
  })

export type CreateLocationInput = z.infer<typeof createLocationSchema>

export const updateLocationSchema = z
  .object({
    name: locationNameSchema.optional(),
    code: optionalCode.optional(),
    parentId: optionalUuid.nullable().optional(),
    picUserId: optionalUuid.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Tidak ada perubahan yang dikirim.",
  })

export type UpdateLocationInput = z.infer<typeof updateLocationSchema>

import { z } from "zod"

// FR-03 (docs/02-prd.md): kategori bersusun dua tingkat. Kategori medis
// mengisi default_calibration_interval_months yang dipakai saat aset dibuat.

export const categoryFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Nama kategori wajib diisi.")
      .max(120, "Nama kategori terlalu panjang."),
    code: z
      .string()
      .trim()
      .max(20, "Kode terlalu panjang.")
      .transform((v) => (v === "" ? null : v.toUpperCase()))
      .nullable(),
    // Induk maksimal satu tingkat di bawah induk — kategori tingkat atas
    // memiliki parentId = null. Validasi "maksimal dua tingkat" diverifikasi
    // di service karena hanya di sanalah struktur pohon dapat dilihat.
    parentId: z.string().uuid("Induk tidak valid.").nullable(),
    isMedicalDevice: z.boolean(),
    defaultCalibrationIntervalMonths: z.coerce
      .number()
      .int("Interval kalibrasi harus bilangan bulat.")
      .min(1, "Interval kalibrasi minimal 1 bulan.")
      .max(120, "Interval kalibrasi terlalu panjang.")
      .nullable(),
  })
  .superRefine((val, ctx) => {
    if (val.isMedicalDevice && val.defaultCalibrationIntervalMonths == null) {
      ctx.addIssue({
        path: ["defaultCalibrationIntervalMonths"],
        code: "custom",
        message: "Kategori alat medis wajib memiliki interval kalibrasi bawaan.",
      })
    }
    if (!val.isMedicalDevice && val.defaultCalibrationIntervalMonths != null) {
      ctx.addIssue({
        path: ["defaultCalibrationIntervalMonths"],
        code: "custom",
        message: "Interval kalibrasi hanya berlaku untuk kategori alat medis.",
      })
    }
  })

export const categoryIdSchema = z.object({
  id: z.string().uuid("Kategori tidak ditemukan."),
})

export const setCategoryActiveSchema = categoryIdSchema.extend({
  isActive: z.boolean(),
})

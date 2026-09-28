import { z } from "zod"

const dateField = z
  .string()
  .trim()
  .min(1, "Tanggal wajib diisi.")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Tanggal tidak valid.")
  .transform((v) => new Date(v))

const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .refine((v) => v === null || !Number.isNaN(Date.parse(v)), "Tanggal tidak valid.")
  .transform((v) => (v === null ? null : new Date(v)))

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Terlalu panjang (maksimal ${max} karakter).`)
    .transform((v) => (v === "" ? null : v))
    .nullable()

/** FR-21: satu aset dapat memiliki beberapa jadwal CALIBRATION/PREVENTIVE. */
export const scheduleFormSchema = z.object({
  assetId: z.string().uuid("Aset tidak ditemukan."),
  type: z.enum(["CALIBRATION", "PREVENTIVE", "CORRECTIVE"]),
  intervalMonths: z.coerce.number().int().min(1).max(120),
  nextDueAt: dateField,
  notes: optionalText(1000),
})

export type ScheduleFormInput = z.infer<typeof scheduleFormSchema>

export const scheduleIdSchema = z.object({ id: z.string().uuid("Jadwal tidak ditemukan.") })

export const setScheduleActiveSchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
})

/** FR-22: pencatatan pelaksanaan — hasil "tidak lulus" mengunci alat dari pemakaian. */
export const recordExecutionSchema = z
  .object({
    scheduleId: z.string().uuid("Jadwal tidak ditemukan."),
    performedAt: dateField,
    performedBy: z.enum(["VENDOR", "INTERNAL"]),
    performedByVendorId: z
      .string()
      .uuid()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    performedByInternal: optionalText(150),
    result: z.enum(["PASS", "PASS_WITH_NOTE", "FAIL"]),
    validUntil: optionalDate,
    certificateNumber: optionalText(100),
    certificateObjectKey: optionalText(500),
    cost: z.coerce
      .number()
      .nonnegative("Biaya tidak boleh negatif.")
      .nullable()
      .or(z.literal("").transform(() => null)),
    partsReplaced: optionalText(500),
    description: optionalText(2000),
  })
  .refine((v) => v.performedBy !== "VENDOR" || !!v.performedByVendorId, {
    message: "Pilih vendor pelaksana.",
    path: ["performedByVendorId"],
  })
  .refine((v) => v.performedBy !== "INTERNAL" || !!v.performedByInternal, {
    message: "Isi nama pelaksana internal.",
    path: ["performedByInternal"],
  })

export type RecordExecutionInput = z.infer<typeof recordExecutionSchema>

export const ACCEPTED_CERTIFICATE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
] as const

export const requestCertificateUploadSchema = z.object({
  assetId: z.string().uuid(),
  scheduleId: z.string().uuid(),
  contentType: z.enum(ACCEPTED_CERTIFICATE_MIME_TYPES, {
    error: "Jenis berkas tidak didukung. Gunakan JPEG, PNG, atau PDF.",
  }),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024, "Berkas terlalu besar (maksimal 10 MB)."),
})

export type RequestCertificateUploadInput = z.infer<typeof requestCertificateUploadSchema>

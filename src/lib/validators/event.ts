import { z } from "zod"

const occurredAtField = z
  .string()
  .trim()
  .min(1, "Waktu kejadian wajib diisi.")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Waktu kejadian tidak valid.")
  .transform((v) => new Date(v))

const optionalNotes = z
  .string()
  .trim()
  .max(4000, "Catatan terlalu panjang.")
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()

/** FR-15: jenis entri yang dapat dicatat manual lewat formulir riwayat umum. */
export const manualEventTypeSchema = z.enum([
  "INSPECTION",
  "MAINTENANCE",
  "REPAIR",
  "CALIBRATION",
  "STATUS_CHANGE",
  "NOTE",
])

export const historyEventSchema = z.object({
  assetId: z.string().uuid("Aset tidak ditemukan."),
  type: manualEventTypeSchema,
  title: z.string().trim().min(1, "Judul wajib diisi.").max(200, "Judul terlalu panjang."),
  notes: optionalNotes,
  occurredAt: occurredAtField,
  newStatus: z
    .enum(["AVAILABLE", "IN_USE", "UNDER_REPAIR", "AT_VENDOR", "DAMAGED", "LOST"])
    .optional(),
})

export type HistoryEventInput = z.infer<typeof historyEventSchema>

/** FR-10: mutasi/transfer ruangan. */
export const transferAssetSchema = z.object({
  assetId: z.string().uuid("Aset tidak ditemukan."),
  toLocationId: z.string().uuid("Ruangan tujuan wajib dipilih."),
  reason: z.string().trim().min(1, "Alasan wajib diisi.").max(500, "Alasan terlalu panjang."),
  occurredAt: occurredAtField,
})

export type TransferAssetInput = z.infer<typeof transferAssetSchema>

/** FR-11: penghapusan aset. */
export const disposeAssetSchema = z.object({
  assetId: z.string().uuid("Aset tidak ditemukan."),
  reason: z.enum(["RUSAK_TOTAL", "HILANG", "DIHIBAHKAN", "DIJUAL", "KEDALUWARSA", "LAINNYA"]),
  occurredAt: occurredAtField,
})

export type DisposeAssetInput = z.infer<typeof disposeAssetSchema>

/** FR-16: koreksi riwayat. */
export const correctEventSchema = z.object({
  eventId: z.string().uuid("Entri riwayat tidak ditemukan."),
  reason: z
    .string()
    .trim()
    .min(1, "Alasan koreksi wajib diisi.")
    .max(1000, "Alasan terlalu panjang."),
})

export type CorrectEventInput = z.infer<typeof correctEventSchema>

/** FR-17: unggahan lampiran, sesudah kompresi di sisi klien. */
export const ACCEPTED_ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const

export const MAX_ATTACHMENTS_PER_EVENT = 5
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024

export const requestUploadSchema = z.object({
  eventId: z.string().uuid("Entri riwayat tidak ditemukan."),
  contentType: z.enum(ACCEPTED_ATTACHMENT_MIME_TYPES, {
    error: "Jenis berkas tidak didukung. Gunakan JPEG, PNG, WebP, atau PDF.",
  }),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_ATTACHMENT_SIZE_BYTES, "Berkas terlalu besar (maksimal 10 MB)."),
  originalFilename: z.string().trim().max(200).optional(),
})

export type RequestUploadInput = z.infer<typeof requestUploadSchema>

export const confirmAttachmentSchema = z.object({
  eventId: z.string().uuid(),
  objectKey: z.string().trim().min(1),
  mimeType: z.enum(ACCEPTED_ATTACHMENT_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_ATTACHMENT_SIZE_BYTES),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  originalFilename: z.string().trim().max(200).optional(),
})

export type ConfirmAttachmentInput = z.infer<typeof confirmAttachmentSchema>

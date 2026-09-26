import { z } from "zod"

const optionalNotes = z
  .string()
  .trim()
  .max(2000, "Catatan terlalu panjang.")
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()

const optionalDateTime = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .refine((v) => v === null || !Number.isNaN(Date.parse(v)), "Tanggal tidak valid.")
  .transform((v) => (v === null ? null : new Date(v)))

/** FR-18: peminjam terdaftar ATAU orang luar (nama, HP, keperluan wajib untuk orang luar). */
export const checkoutLoanSchema = z
  .object({
    assetId: z.string().uuid("Aset tidak ditemukan."),
    borrowerType: z.enum(["INTERNAL_USER", "EXTERNAL_PERSON"]),
    borrowerUserId: z
      .string()
      .uuid()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    borrowerName: z
      .string()
      .trim()
      .max(150)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    borrowerPhone: z
      .string()
      .trim()
      .max(30)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    borrowerUnit: z
      .string()
      .trim()
      .max(150)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    purpose: z
      .string()
      .trim()
      .min(1, "Keperluan wajib diisi.")
      .max(500, "Keperluan terlalu panjang."),
    dueAt: optionalDateTime,
    conditionOut: z.enum(["GOOD", "MINOR_ISSUE", "NEEDS_REPAIR", "UNUSABLE"]),
  })
  .refine((v) => v.borrowerType !== "INTERNAL_USER" || !!v.borrowerUserId, {
    message: "Pilih peminjam terdaftar.",
    path: ["borrowerUserId"],
  })
  .refine((v) => v.borrowerType !== "EXTERNAL_PERSON" || !!v.borrowerName, {
    message: "Nama peminjam wajib diisi.",
    path: ["borrowerName"],
  })
  .refine((v) => v.borrowerType !== "EXTERNAL_PERSON" || !!v.borrowerPhone, {
    message: "Nomor HP peminjam wajib diisi.",
    path: ["borrowerPhone"],
  })

export type CheckoutLoanInput = z.infer<typeof checkoutLoanSchema>

/** FR-19: pengembalian. */
export const returnLoanSchema = z.object({
  loanId: z.string().uuid("Peminjaman tidak ditemukan."),
  conditionIn: z.enum(["GOOD", "MINOR_ISSUE", "NEEDS_REPAIR", "UNUSABLE"]),
  returnNotes: optionalNotes,
})

export type ReturnLoanInput = z.infer<typeof returnLoanSchema>

import { z } from "zod";

/** Form fields arrive as "" when left empty; treat that as "not given". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

const requiredText = (message: string, max = 200) => z.string().trim().min(1, message).max(max);

const isoDate = (message: string) => z.iso.date(message);

const optionalDate = z
  .union([z.literal(""), z.iso.date("Tanggal tidak valid")])
  .optional()
  .transform((v) => (v ? v : undefined));

/** Fields every maintenance form shares (docs/06 §4). */
const common = {
  performedOn: isoDate("Tanggal wajib diisi"),
  performer: requiredText("Pelaksana wajib diisi", 120),
  cost: z.number().int("Biaya harus bilangan bulat").min(0, "Biaya tidak boleh negatif").optional(),
  note: optionalText(1000),
  damagedAfter: z
    .number("Jumlah rusak wajib diisi")
    .int("Jumlah rusak harus bilangan bulat")
    .min(0, "Jumlah rusak tidak boleh negatif"),
  actorName: requiredText("Nama petugas wajib diisi", 80),
};

const perbaikan = z.object({
  type: z.literal("PERBAIKAN"),
  ...common,
  details: z.object({
    complaint: requiredText("Keluhan/kerusakan wajib diisi", 1000),
    action: optionalText(1000),
    parts: optionalText(1000),
    finishedOn: optionalDate,
  }),
});

const pemeliharaan = z.object({
  type: z.literal("PEMELIHARAAN"),
  ...common,
  nextDue: optionalDate,
  details: z.object({
    activities: requiredText("Kegiatan wajib diisi", 1000),
    findings: optionalText(1000),
  }),
});

const kalibrasi = z.object({
  type: z.literal("KALIBRASI"),
  ...common,
  details: z.object({
    institution: requiredText("Lembaga kalibrasi wajib diisi"),
    certificateNo: optionalText(120),
    result: z.enum(["LULUS", "TIDAK_LULUS"], "Hasil kalibrasi wajib dipilih"),
    validUntil: isoDate("Tanggal berlaku sampai wajib diisi"),
  }),
});

export const maintenanceSchema = z
  .discriminatedUnion("type", [perbaikan, pemeliharaan, kalibrasi])
  .superRefine((input, ctx) => {
    // ISO dates compare correctly as strings.
    if (input.type === "KALIBRASI" && input.details.validUntil < input.performedOn) {
      ctx.addIssue({
        code: "custom",
        path: ["details", "validUntil"],
        message: "Berlaku sampai tidak boleh sebelum tanggal kalibrasi",
      });
    }
  });

export type MaintenanceInput = z.input<typeof maintenanceSchema>;
export type MaintenanceData = z.output<typeof maintenanceSchema>;

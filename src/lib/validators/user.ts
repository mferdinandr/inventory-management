import { z } from "zod";
import { MIN_PASSWORD_LENGTH } from "@/server/auth/password";

export const roleSchema = z.enum(["OPERASI", "STERIL", "ALKES", "SUPERADMIN"]);

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter`)
  .max(128, "Kata sandi terlalu panjang");

export const createUserSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,32}$/, "Username 3-32 karakter: huruf kecil, angka, titik, strip"),
  name: z.string().trim().min(1, "Nama wajib diisi").max(80),
  role: roleSchema,
  password: passwordSchema,
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  role: roleSchema.optional(),
  isActive: z.boolean().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

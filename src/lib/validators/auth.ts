import { z } from "zod"

// docs/07-rbac-security.md §4: "Kata sandi minimal 10 karakter, di-hash dengan Argon2id."
// Bcrypt is used instead here (see credentials.service.ts); the length floor is the
// part that's actually load-bearing for this schema, not the hashing algorithm choice.
export const passwordSchema = z
  .string()
  .min(10, "Kata sandi minimal 10 karakter.")
  .max(200, "Kata sandi terlalu panjang.")

export const emailSchema = z.string().trim().toLowerCase().email("Alamat email tidak valid.")

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
})

export const requestPasswordResetSchema = z.object({
  email: emailSchema,
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
})

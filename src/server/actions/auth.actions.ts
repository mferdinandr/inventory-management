"use server"

import {
  acceptInviteSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
} from "@/lib/validators/auth"
import {
  acceptInvite,
  requestPasswordReset,
  resetPassword,
  type TokenActionResult,
} from "@/server/services/auth-token.service"

// Route handlers and Server Actions only validate input and call the
// service (docs/04-technical-architecture.md §3) — the actual logic lives
// in auth-token.service.ts.

export async function acceptInviteAction(
  token: string,
  password: string,
): Promise<TokenActionResult> {
  const parsed = acceptInviteSchema.safeParse({ token, password })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }
  return acceptInvite(parsed.data.token, parsed.data.password)
}

export async function requestPasswordResetAction(email: string): Promise<{ ok: true }> {
  const parsed = requestPasswordResetSchema.safeParse({ email })
  // Always the same shape regardless of validity, existence, or ambiguity —
  // see requestPasswordReset()'s own doc comment.
  if (parsed.success) {
    await requestPasswordReset(parsed.data.email)
  }
  return { ok: true }
}

export async function resetPasswordAction(
  token: string,
  password: string,
): Promise<TokenActionResult> {
  const parsed = resetPasswordSchema.safeParse({ token, password })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." }
  }
  return resetPassword(parsed.data.token, parsed.data.password)
}

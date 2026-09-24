import "server-only"
import bcrypt from "bcryptjs"
import { generateToken, hashToken } from "@/lib/tokens"
import { dbPlatform } from "@/server/db-platform"
import { sendMail } from "@/server/mailer"

const RESET_TTL_MS = 60 * 60 * 1000 // 1 jam — docs/07-rbac-security.md §4

export type TokenActionResult = { ok: true } | { ok: false; error: string }

/**
 * Undangan dan atur ulang kata sandi keduanya konsumsi token sebelum sesi
 * (dan karenanya organisasi) diketahui — sama seperti login,
 * lihat credentials.service.ts. dbPlatform (BYPASSRLS) dipakai di seluruh
 * berkas ini untuk alasan yang sama, bukan hanya di satu fungsi.
 */

export async function acceptInvite(token: string, password: string): Promise<TokenActionResult> {
  const hash = hashToken(token)
  const user = await dbPlatform.user.findFirst({
    where: { inviteTokenHash: hash, status: "INVITED" },
  })
  if (!user) return { ok: false, error: "Tautan undangan tidak valid atau sudah dipakai." }
  if (!user.inviteExpiresAt || user.inviteExpiresAt < new Date()) {
    return { ok: false, error: "Tautan undangan sudah kedaluwarsa. Minta undangan baru." }
  }

  const passwordHash = await bcrypt.hash(password, 12)
  await dbPlatform.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      status: "ACTIVE",
      inviteTokenHash: null,
      inviteExpiresAt: null,
    },
  })
  return { ok: true }
}

/**
 * Selalu berperilaku sama baik email ditemukan, tidak ditemukan, maupun
 * ambigu (dipakai lebih dari satu organisasi — batasan yang sama dengan
 * login, lihat credentials.service.ts) — supaya tidak membocorkan alamat
 * email mana yang terdaftar.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase()
  const users = await dbPlatform.user.findMany({
    where: { email: normalized, status: "ACTIVE" },
  })
  if (users.length !== 1) return
  const user = users[0]!

  const { token, hash } = generateToken()
  const expiresAt = new Date(Date.now() + RESET_TTL_MS)

  await dbPlatform.user.update({
    where: { id: user.id },
    data: { inviteTokenHash: hash, inviteExpiresAt: expiresAt },
  })

  await sendMail({
    to: user.email,
    subject: "Atur ulang kata sandi SIMASET",
    html: `
      <p>Ada permintaan atur ulang kata sandi untuk akun Anda.</p>
      <p><a href="${process.env.APP_URL}/reset-password/${token}">Atur kata sandi baru</a></p>
      <p>Tautan ini berlaku 1 jam. Abaikan pesan ini bila Anda tidak meminta ini.</p>
    `,
  })
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<TokenActionResult> {
  const hash = hashToken(token)
  const user = await dbPlatform.user.findFirst({
    where: { inviteTokenHash: hash, status: "ACTIVE" },
  })
  if (!user) return { ok: false, error: "Tautan tidak valid atau sudah dipakai." }
  if (!user.inviteExpiresAt || user.inviteExpiresAt < new Date()) {
    return { ok: false, error: "Tautan sudah kedaluwarsa. Minta tautan baru." }
  }

  const passwordHash = await bcrypt.hash(newPassword, 12)
  await dbPlatform.user.update({
    where: { id: user.id },
    data: { passwordHash, inviteTokenHash: null, inviteExpiresAt: null },
  })
  return { ok: true }
}

import "server-only"
import { generateToken } from "@/lib/tokens"
import { withOrg } from "@/server/db"
import { escapeHtml, sendMail } from "@/server/mailer"
import { assertOrgWritable, assertUserQuota } from "@/server/quota"
import type { UserRole } from "../../../generated/prisma/enums"

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 hari — docs/07-rbac-security.md §4

export class UserAlreadyExistsError extends Error {
  constructor() {
    super("Sudah ada pengguna dengan email ini di organisasi Anda.")
    this.name = "UserAlreadyExistsError"
  }
}

export type InviteUserInput = {
  organizationId: string
  email: string
  name: string
  role: Exclude<UserRole, "PLATFORM_OWNER">
}

/**
 * FR-05 (docs/02-prd.md): admin mengundang pengguna lewat email. Berjalan di
 * dalam withOrg() — pemanggil sudah punya sesi dan cakupan organisasi, jadi
 * ini INSERT biasa yang tunduk RLS, bukan operasi lintas tenant seperti
 * accept-invite.service.ts.
 */
export async function inviteUser(
  input: InviteUserInput,
): Promise<{ userId: string; inviteToken: string }> {
  const email = input.email.trim().toLowerCase()
  const { token, hash } = generateToken()
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS)

  const user = await withOrg(input.organizationId, async (tx) => {
    await assertOrgWritable(input.organizationId, tx)
    await assertUserQuota(input.organizationId, tx)

    const existing = await tx.user.findUnique({
      where: { organizationId_email: { organizationId: input.organizationId, email } },
      select: { id: true },
    })
    if (existing) throw new UserAlreadyExistsError()

    return tx.user.create({
      data: {
        organizationId: input.organizationId,
        email,
        name: input.name,
        role: input.role,
        status: "INVITED",
        inviteTokenHash: hash,
        inviteExpiresAt: expiresAt,
      },
      select: { id: true, organization: { select: { name: true } } },
    })
  })

  await sendMail({
    to: email,
    subject: `Undangan bergabung di SIMASET — ${user.organization?.name ?? ""}`,
    html: `
      <p>Halo ${escapeHtml(input.name)},</p>
      <p>Anda diundang bergabung di SIMASET untuk ${escapeHtml(user.organization?.name ?? "organisasi Anda")}.</p>
      <p><a href="${process.env.APP_URL}/invite/${token}">Terima undangan dan atur kata sandi</a></p>
      <p>Tautan ini berlaku 7 hari.</p>
    `,
  })

  return { userId: user.id, inviteToken: token }
}

/**
 * FR-05: "Undangan kedaluwarsa dalam 7 hari dan dapat dikirim ulang." Hanya
 * berlaku untuk pengguna yang masih berstatus INVITED — tidak mengganggu
 * akun yang sudah aktif.
 */
export async function resendInvite(
  organizationId: string,
  userId: string,
): Promise<{ inviteToken: string }> {
  const { token, hash } = generateToken()
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS)

  const user = await withOrg(organizationId, async (tx) => {
    await assertOrgWritable(organizationId, tx)
    const existing = await tx.user.findUnique({ where: { id: userId } })
    if (existing?.status !== "INVITED") {
      throw new Error("Pengguna tidak ditemukan atau sudah aktif.")
    }
    return tx.user.update({
      where: { id: userId },
      data: { inviteTokenHash: hash, inviteExpiresAt: expiresAt },
      select: { email: true, name: true, organization: { select: { name: true } } },
    })
  })

  await sendMail({
    to: user.email,
    subject: `Undangan bergabung di SIMASET — ${user.organization?.name ?? ""}`,
    html: `
      <p>Halo ${escapeHtml(user.name)},</p>
      <p>Berikut tautan undangan baru Anda ke SIMASET.</p>
      <p><a href="${process.env.APP_URL}/invite/${token}">Terima undangan dan atur kata sandi</a></p>
      <p>Tautan ini berlaku 7 hari.</p>
    `,
  })

  return { inviteToken: token }
}

import { PrismaPg } from "@prisma/adapter-pg"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { PrismaClient } from "../generated/prisma/client"

// sendMail is the only way requestPasswordReset()/inviteUser() ever expose their
// raw token — by design (docs/07: the token is emailed, never returned to a
// caller). Mocking it here is what makes a genuine end-to-end test possible
// instead of one that stops short of actually consuming the token.
const sentMail: Array<{ to: string; subject: string; html: string }> = []
vi.mock("@/server/mailer", () => ({
  sendMail: vi.fn(async (input: { to: string; subject: string; html: string }) => {
    sentMail.push(input)
    return { ok: true }
  }),
}))

function extractToken(html: string, path: "invite" | "reset-password"): string {
  const match = html.match(new RegExp(`/${path}/([A-Za-z0-9_-]+)`))
  if (!match) throw new Error(`No ${path} link found in sent email:\n${html}`)
  return match[1]!
}

const { verifyCredentials } = await import("../src/server/services/credentials.service")
const { acceptInvite, requestPasswordReset, resetPassword } = await import(
  "../src/server/services/auth-token.service"
)
const { inviteUser, resendInvite, UserAlreadyExistsError } = await import(
  "../src/server/services/invite.service"
)

const setup = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL_PLATFORM ?? process.env.DATABASE_URL ?? "",
  }),
})

let orgId: string

beforeAll(async () => {
  const org = await setup.organization.findFirstOrThrow({
    where: { code: "RS01" },
    select: { id: true },
  })
  orgId = org.id
})

afterAll(async () => {
  await setup.$disconnect()
})

function uniqueEmail() {
  return `invite-test-${Date.now()}-${Math.random().toString(36).slice(2)}@simaset.test`
}

describe("invite → accept → login", () => {
  it("a full round trip works end to end", async () => {
    const email = uniqueEmail()
    const { userId, inviteToken } = await inviteUser({
      organizationId: orgId,
      email,
      name: "Petugas Uji",
      role: "PIC_ROOM",
    })
    expect(userId).toBeTruthy()

    const before = await setup.user.findUniqueOrThrow({ where: { id: userId } })
    expect(before.status).toBe("INVITED")
    expect(before.passwordHash).toBeNull()

    // Belum bisa masuk sebelum undangan diterima.
    expect(await verifyCredentials(email, "kata-sandi-baru-123")).toBeNull()

    const accepted = await acceptInvite(inviteToken, "kata-sandi-baru-123")
    expect(accepted).toEqual({ ok: true })

    const after = await setup.user.findUniqueOrThrow({ where: { id: userId } })
    expect(after.status).toBe("ACTIVE")
    expect(after.passwordHash).not.toBeNull()
    expect(after.inviteTokenHash).toBeNull()
    expect(after.inviteExpiresAt).toBeNull()

    const loggedIn = await verifyCredentials(email, "kata-sandi-baru-123")
    expect(loggedIn?.id).toBe(userId)
  })

  it("rejects an unknown token", async () => {
    const result = await acceptInvite("token-yang-tidak-pernah-ada", "kata-sandi-baru-123")
    expect(result).toEqual({ ok: false, error: expect.any(String) })
  })

  it("rejects an expired token", async () => {
    const email = uniqueEmail()
    const { userId, inviteToken } = await inviteUser({
      organizationId: orgId,
      email,
      name: "Petugas Kedaluwarsa",
      role: "VIEWER",
    })
    // Simulasikan token yang sudah lewat masa berlakunya.
    await setup.user.update({
      where: { id: userId },
      data: { inviteExpiresAt: new Date(Date.now() - 1000) },
    })
    const result = await acceptInvite(inviteToken, "kata-sandi-baru-123")
    expect(result.ok).toBe(false)
  })

  it("a second invite token invalidates the first (only one active token per user)", async () => {
    const email = uniqueEmail()
    const first = await inviteUser({
      organizationId: orgId,
      email,
      name: "Dua Token",
      role: "VIEWER",
    })
    const second = await resendInvite(orgId, first.userId)

    expect(await acceptInvite(first.inviteToken, "kata-sandi-baru-123")).toEqual({
      ok: false,
      error: expect.any(String),
    })
    expect(await acceptInvite(second.inviteToken, "kata-sandi-baru-123")).toEqual({ ok: true })
  })

  it("refuses to invite an email that already exists in the organization", async () => {
    const email = uniqueEmail()
    await inviteUser({ organizationId: orgId, email, name: "Sudah Ada", role: "VIEWER" })
    await expect(
      inviteUser({ organizationId: orgId, email, name: "Sudah Ada Lagi", role: "VIEWER" }),
    ).rejects.toThrow(UserAlreadyExistsError)
  })
})

describe("forgot password → reset → login with new password", () => {
  it("a full round trip works end to end, token included — via the actual sent email", async () => {
    const email = uniqueEmail()
    const { inviteToken } = await inviteUser({
      organizationId: orgId,
      email,
      name: "Lupa Sandi",
      role: "ADMIN",
    })
    await acceptInvite(inviteToken, "kata-sandi-lama-123")
    expect(await verifyCredentials(email, "kata-sandi-lama-123")).not.toBeNull()

    const before = sentMail.length
    await requestPasswordReset(email)
    expect(sentMail.length).toBe(before + 1)
    const resetToken = extractToken(sentMail.at(-1)!.html, "reset-password")

    // Sandi lama masih berlaku — reset belum dikonfirmasi.
    expect(await verifyCredentials(email, "kata-sandi-lama-123")).not.toBeNull()

    const result = await resetPassword(resetToken, "kata-sandi-baru-456")
    expect(result).toEqual({ ok: true })

    expect(await verifyCredentials(email, "kata-sandi-lama-123")).toBeNull()
    expect(await verifyCredentials(email, "kata-sandi-baru-456")).not.toBeNull()

    // Token sekali pakai — memakainya dua kali harus gagal.
    expect(await resetPassword(resetToken, "kata-sandi-lagi-789")).toEqual({
      ok: false,
      error: expect.any(String),
    })
  })

  it("rejects reset for an unknown or INVITED (not yet active) email — no email is sent", async () => {
    const email = uniqueEmail()
    const { userId } = await inviteUser({
      organizationId: orgId,
      email,
      name: "Belum Aktif",
      role: "VIEWER",
    })
    const invited = await setup.user.findUniqueOrThrow({ where: { id: userId } })

    const before = sentMail.length
    await requestPasswordReset(email) // masih INVITED, belum ACTIVE
    expect(sentMail.length).toBe(before) // tidak ada email reset terkirim

    const stillInvited = await setup.user.findUniqueOrThrow({ where: { id: userId } })
    // Token undangan asli tidak tersentuh oleh permintaan reset yang ditolak.
    expect(stillInvited.inviteTokenHash).toBe(invited.inviteTokenHash)
    expect(stillInvited.status).toBe("INVITED")
  })

  it("silently does nothing for an email that was never registered", async () => {
    const before = sentMail.length
    await requestPasswordReset("tidak-pernah-daftar@simaset.test")
    expect(sentMail.length).toBe(before)
  })

  it("resetPassword rejects an unknown token", async () => {
    const result = await resetPassword("token-yang-tidak-pernah-ada", "kata-sandi-baru-123")
    expect(result.ok).toBe(false)
  })
})

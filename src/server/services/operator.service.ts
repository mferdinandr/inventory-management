import "server-only"
import { createHmac, timingSafeEqual } from "node:crypto"
import { isIP } from "node:net"
import { generateToken } from "@/lib/tokens"
import {
  type CreateOrganizationInput,
  GB,
  type UpdateOrganizationInput,
} from "@/lib/validators/organization"
import { dbPlatform } from "@/server/db-platform"
import { escapeHtml, sendMail } from "@/server/mailer"
import type { Prisma } from "../../../generated/prisma/client"
import type { OrganizationStatus } from "../../../generated/prisma/enums"

// FR-01b (docs/02-prd.md): panel operator milik PLATFORM_OWNER. Seluruh kueri di
// sini lintas organisasi, jadi memakai dbPlatform (BYPASSRLS) — biome.json
// membatasi siapa saja yang boleh mengimpor berkas ini. Setiap mutasi dicatat di
// audit_logs organisasi sasaran agar terlihat oleh pelanggan (docs/07 §1).

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 hari — docs/07-rbac-security.md §4

export class OperatorError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "OperatorError"
  }
}

export type OrganizationSummary = {
  id: string
  name: string
  code: string
  status: OrganizationStatus
  timezone: string
  createdAt: Date
  quota: { assets: number; storageBytes: bigint; users: number }
  usage: { assets: number; storageBytes: bigint; users: number }
}

const summarySelect = {
  id: true,
  name: true,
  code: true,
  status: true,
  timezone: true,
  createdAt: true,
  quotaAssets: true,
  quotaStorageBytes: true,
  quotaUsers: true,
  usedStorageBytes: true,
} satisfies Prisma.OrganizationSelect

type SummaryRow = Prisma.OrganizationGetPayload<{ select: typeof summarySelect }>

// Definisi "terpakai" sama dengan src/server/quota.ts: aset selain DISPOSED,
// pengguna ACTIVE + INVITED (undangan yang belum diterima tetap memakan kursi).
async function usageByOrganization(
  organizationIds: string[],
): Promise<Map<string, { assets: number; users: number }>> {
  const [assets, users] = await Promise.all([
    dbPlatform.asset.groupBy({
      by: ["organizationId"],
      where: { organizationId: { in: organizationIds }, status: { not: "DISPOSED" } },
      _count: { _all: true },
    }),
    dbPlatform.user.groupBy({
      by: ["organizationId"],
      where: { organizationId: { in: organizationIds }, status: { in: ["ACTIVE", "INVITED"] } },
      _count: { _all: true },
    }),
  ])
  const usage = new Map(organizationIds.map((id) => [id, { assets: 0, users: 0 }]))
  for (const row of assets) usage.get(row.organizationId)!.assets = row._count._all
  for (const row of users) {
    if (row.organizationId) usage.get(row.organizationId)!.users = row._count._all
  }
  return usage
}

function toSummary(row: SummaryRow, usage: { assets: number; users: number }): OrganizationSummary {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    status: row.status,
    timezone: row.timezone,
    createdAt: row.createdAt,
    quota: { assets: row.quotaAssets, storageBytes: row.quotaStorageBytes, users: row.quotaUsers },
    usage: { assets: usage.assets, storageBytes: row.usedStorageBytes, users: usage.users },
  }
}

export async function listOrganizations(): Promise<OrganizationSummary[]> {
  const rows = await dbPlatform.organization.findMany({
    select: summarySelect,
    orderBy: { createdAt: "desc" },
  })
  const usage = await usageByOrganization(rows.map((r) => r.id))
  return rows.map((row) => toSummary(row, usage.get(row.id)!))
}

export type OrganizationDetail = OrganizationSummary & {
  showGovernmentFields: boolean
  contact: { name: string | null; email: string | null; phone: string | null }
  admins: Array<{ id: string; name: string; email: string; status: string }>
}

export async function getOrganization(id: string): Promise<OrganizationDetail | null> {
  const row = await dbPlatform.organization.findUnique({
    where: { id },
    select: {
      ...summarySelect,
      showGovernmentFields: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
    },
  })
  if (!row) return null
  const [usage, admins] = await Promise.all([
    usageByOrganization([id]),
    dbPlatform.user.findMany({
      where: { organizationId: id, role: "SUPERADMIN" },
      select: { id: true, name: true, email: true, status: true },
      orderBy: { createdAt: "asc" },
    }),
  ])
  return {
    ...toSummary(row, usage.get(id)!),
    showGovernmentFields: row.showGovernmentFields,
    contact: { name: row.contactName, email: row.contactEmail, phone: row.contactPhone },
    admins,
  }
}

/**
 * Membuat organisasi pelanggan beserta SUPERADMIN pertamanya (status INVITED),
 * lalu mengirim undangan. Kategori sengaja tidak diisi otomatis (FR-03) —
 * pelanggan menyusunnya sendiri dari halaman kategori kosong.
 *
 * Email dikirim setelah transaksi selesai: kegagalan SMTP tidak membatalkan
 * organisasi, dan undangan dapat dikirim ulang dari halaman detail.
 */
export async function createOrganization(
  actorUserId: string,
  input: CreateOrganizationInput,
): Promise<{ organizationId: string; inviteToken: string; mailSent: boolean }> {
  const { token, hash } = generateToken()

  const org = await dbPlatform.$transaction(async (tx) => {
    const existing = await tx.organization.findUnique({
      where: { code: input.code },
      select: { id: true },
    })
    if (existing) throw new OperatorError(`Kode organisasi "${input.code}" sudah dipakai.`)

    const created = await tx.organization.create({
      data: {
        name: input.name,
        code: input.code,
        timezone: input.timezone,
        status: input.status,
        quotaAssets: input.quotaAssets,
        quotaStorageBytes: BigInt(input.quotaStorageGb) * BigInt(GB),
        quotaUsers: input.quotaUsers,
        showGovernmentFields: input.showGovernmentFields,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
      },
      select: { id: true, name: true },
    })

    const admin = await tx.user.create({
      data: {
        organizationId: created.id,
        email: input.adminEmail,
        name: input.adminName,
        role: "SUPERADMIN",
        status: "INVITED",
        inviteTokenHash: hash,
        inviteExpiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
      select: { id: true },
    })

    await tx.auditLog.create({
      data: {
        organizationId: created.id,
        actorUserId,
        action: "platform.organization.create",
        entityType: "organization",
        entityId: created.id,
        changes: {
          name: input.name,
          code: input.code,
          timezone: input.timezone,
          status: input.status,
          quotaAssets: input.quotaAssets,
          quotaStorageGb: input.quotaStorageGb,
          quotaUsers: input.quotaUsers,
          showGovernmentFields: input.showGovernmentFields,
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
        },
      },
    })
    await tx.auditLog.create({
      data: {
        organizationId: created.id,
        actorUserId,
        action: "user.invite",
        entityType: "user",
        entityId: admin.id,
        changes: { email: input.adminEmail, role: "SUPERADMIN" },
      },
    })

    return created
  })

  const mail = await sendAdminInvite(input.adminEmail, input.adminName, org.name, token)
  return { organizationId: org.id, inviteToken: token, mailSent: mail.ok }
}

/** Mengirim ulang undangan SUPERADMIN yang belum diterima — token lama tidak berlaku lagi. */
export async function resendAdminInvite(
  actorUserId: string,
  organizationId: string,
  userId: string,
): Promise<{ inviteToken: string; mailSent: boolean }> {
  const { token, hash } = generateToken()

  const user = await dbPlatform.$transaction(async (tx) => {
    const existing = await tx.user.findFirst({
      where: { id: userId, organizationId, role: "SUPERADMIN", status: "INVITED" },
      select: { id: true },
    })
    if (!existing) throw new OperatorError("Undangan tidak ditemukan atau sudah diterima.")
    const updated = await tx.user.update({
      where: { id: userId },
      data: { inviteTokenHash: hash, inviteExpiresAt: new Date(Date.now() + INVITE_TTL_MS) },
      select: { email: true, name: true, organization: { select: { name: true } } },
    })
    await tx.auditLog.create({
      data: {
        organizationId,
        actorUserId,
        action: "user.invite.resend",
        entityType: "user",
        entityId: userId,
      },
    })
    return updated
  })

  const mail = await sendAdminInvite(user.email, user.name, user.organization?.name ?? "", token)
  return { inviteToken: token, mailSent: mail.ok }
}

function sendAdminInvite(email: string, name: string, orgName: string, token: string) {
  return sendMail({
    to: email,
    subject: `Undangan Super Admin SIMASET — ${orgName}`,
    html: `
      <p>Halo ${escapeHtml(name)},</p>
      <p>SIMASET untuk ${escapeHtml(orgName)} sudah siap. Anda diundang sebagai Super Admin pertama.</p>
      <p><a href="${process.env.APP_URL}/invite/${token}">Terima undangan dan atur kata sandi</a></p>
      <p>Tautan ini berlaku 7 hari.</p>
    `,
  })
}

/** Mengubah kuota, status langganan, dan narahubung. Hanya kolom yang berubah yang dicatat. */
export async function updateOrganization(
  actorUserId: string,
  organizationId: string,
  input: UpdateOrganizationInput,
): Promise<void> {
  await dbPlatform.$transaction(async (tx) => {
    const before = await tx.organization.findUnique({
      where: { id: organizationId },
      select: {
        status: true,
        quotaAssets: true,
        quotaStorageBytes: true,
        quotaUsers: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
      },
    })
    if (!before) throw new OperatorError("Organisasi tidak ditemukan.")

    const next = {
      status: input.status,
      quotaAssets: input.quotaAssets,
      quotaStorageBytes: BigInt(input.quotaStorageGb) * BigInt(GB),
      quotaUsers: input.quotaUsers,
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
    }
    const changes: Record<string, { from: JsonScalar; to: JsonScalar }> = {}
    for (const key of Object.keys(next) as Array<keyof typeof next>) {
      if (before[key] !== next[key]) {
        // BigInt tidak dapat diserialisasi ke JSON — simpan sebagai angka biasa.
        changes[key] = { from: jsonable(before[key]), to: jsonable(next[key]) }
      }
    }
    if (Object.keys(changes).length === 0) return

    await tx.organization.update({ where: { id: organizationId }, data: next })
    await tx.auditLog.create({
      data: {
        organizationId,
        actorUserId,
        action: "platform.organization.update",
        entityType: "organization",
        entityId: organizationId,
        changes,
      },
    })
  })
}

type JsonScalar = string | number | null

function jsonable(value: string | number | bigint | null): JsonScalar {
  return typeof value === "bigint" ? Number(value) : value
}

// ---------------------------------------------------------------------------
// "Masuk sebagai" (FR-01b, docs/07 §1)
//
// Panel operator tidak mengubah sesi secara langsung. Ia menulis baris audit
// `platform.impersonate`, lalu menerbitkan tiket bertanda tangan HMAC berumur
// pendek yang ditukar lewat provider Credentials `platform-session` (auth.ts).
// Tiket yang sama dipakai untuk kembali ke panel (orgId kosong). Tanpa rahasia
// AUTH_SECRET, tiket tidak dapat dipalsukan; dengan umur 60 detik, tiket yang
// bocor hampir tidak berguna.
// ---------------------------------------------------------------------------

const TICKET_TTL_SECONDS = 60

export type PlatformTicket = {
  actorUserId: string
  organizationId: string
  exp: string
  sig: string
}

function ticketSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET belum disetel.")
  return secret
}

function signTicket(actorUserId: string, organizationId: string, exp: string): string {
  return createHmac("sha256", ticketSecret())
    .update(`platform-session:v1:${actorUserId}:${organizationId}:${exp}`)
    .digest("hex")
}

function issueTicket(actorUserId: string, organizationId: string | null): PlatformTicket {
  const exp = String(Math.floor(Date.now() / 1000) + TICKET_TTL_SECONDS)
  const org = organizationId ?? ""
  return { actorUserId, organizationId: org, exp, sig: signTicket(actorUserId, org, exp) }
}

export type RequestMeta = { ipAddress: string | null; userAgent: string | null }

function auditMeta(meta: RequestMeta) {
  // Kolom ip_address bertipe INET — nilai header yang tidak valid akan menggagalkan INSERT.
  const ip = meta.ipAddress?.trim() ?? null
  return {
    ipAddress: ip && isIP(ip) ? ip : null,
    userAgent: meta.userAgent?.slice(0, 500) ?? null,
  }
}

export async function startImpersonation(
  actorUserId: string,
  organizationId: string,
  meta: RequestMeta,
): Promise<PlatformTicket> {
  const org = await dbPlatform.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  })
  if (!org) throw new OperatorError("Organisasi tidak ditemukan.")

  await dbPlatform.auditLog.create({
    data: {
      organizationId,
      actorUserId,
      action: "platform.impersonate",
      entityType: "organization",
      entityId: organizationId,
      changes: { organizationName: org.name },
      ...auditMeta(meta),
    },
  })
  return issueTicket(actorUserId, organizationId)
}

export async function endImpersonation(
  actorUserId: string,
  organizationId: string,
  meta: RequestMeta,
): Promise<PlatformTicket> {
  await dbPlatform.auditLog.create({
    data: {
      organizationId,
      actorUserId,
      action: "platform.impersonate.end",
      entityType: "organization",
      entityId: organizationId,
      ...auditMeta(meta),
    },
  })
  return issueTicket(actorUserId, null)
}

export type PlatformSessionUser = {
  id: string
  email: string
  name: string
  role: "PLATFORM_OWNER"
  status: "ACTIVE"
  organizationId: string | null
  impersonating: boolean
}

/**
 * Dipanggil oleh authorize() provider `platform-session`. Mengembalikan null
 * bila tiket palsu/kedaluwarsa, pemiliknya bukan PLATFORM_OWNER aktif, atau
 * organisasinya sudah tidak ada.
 */
export async function redeemTicket(
  raw: Partial<Record<keyof PlatformTicket, unknown>>,
): Promise<PlatformSessionUser | null> {
  const actorUserId = String(raw.actorUserId ?? "")
  const organizationId = String(raw.organizationId ?? "")
  const exp = String(raw.exp ?? "")
  const sig = String(raw.sig ?? "")
  if (!actorUserId || !/^\d+$/.test(exp) || !/^[0-9a-f]{64}$/.test(sig)) return null
  if (Number(exp) < Math.floor(Date.now() / 1000)) return null

  const expected = Buffer.from(signTicket(actorUserId, organizationId, exp), "hex")
  if (!timingSafeEqual(expected, Buffer.from(sig, "hex"))) return null

  const owner = await dbPlatform.user.findFirst({
    where: { id: actorUserId, role: "PLATFORM_OWNER", status: "ACTIVE" },
    select: { id: true, email: true, name: true },
  })
  if (!owner) return null

  if (organizationId) {
    const org = await dbPlatform.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    })
    if (!org) return null
  }

  return {
    ...owner,
    role: "PLATFORM_OWNER",
    status: "ACTIVE",
    organizationId: organizationId || null,
    impersonating: organizationId !== "",
  }
}

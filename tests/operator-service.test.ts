/**
 * Integration tests for src/server/services/operator.service.ts (FR-01b) against the
 * seeded development database. Covers: creating an organization together with its
 * first SUPERADMIN invite, quota/status updates, and the "masuk sebagai" ticket —
 * including that the `platform.impersonate` row is visible to the customer through
 * the RLS-bound connection (docs/07-rbac-security.md §1).
 */
import { createHmac } from "node:crypto"
import { PrismaPg } from "@prisma/adapter-pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { PrismaClient } from "../generated/prisma/client"
import { hashToken } from "../src/lib/tokens"
import { type CreateOrganizationInput, GB } from "../src/lib/validators/organization"
import { withOrg } from "../src/server/db"
import {
  createOrganization,
  endImpersonation,
  getOrganization,
  listOrganizations,
  OperatorError,
  redeemTicket,
  resendAdminInvite,
  startImpersonation,
  updateOrganization,
} from "../src/server/services/operator.service"

// Bypasses RLS (role simaset_platform) — fixture lookup and cleanup only.
const setup = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL_PLATFORM ?? process.env.DATABASE_URL ?? "",
  }),
})

const meta = { ipAddress: "203.0.113.7", userAgent: "vitest" }
const createdOrgIds: string[] = []
let ownerId: string
let customerAdminId: string
let runId: string

function makeInput(overrides: Partial<CreateOrganizationInput> = {}): CreateOrganizationInput {
  return {
    name: `RS Uji ${runId}`,
    code: `T-${runId}`,
    timezone: "Asia/Makassar",
    status: "TRIAL",
    quotaAssets: 2000,
    quotaStorageGb: 20,
    quotaUsers: 50,
    adminName: "Siti Aminah",
    adminEmail: `admin-${runId}@rs-uji.test`,
    ...overrides,
  }
}

async function newOrganization(overrides: Partial<CreateOrganizationInput> = {}) {
  const result = await createOrganization(ownerId, makeInput(overrides))
  createdOrgIds.push(result.organizationId)
  return result
}

beforeAll(async () => {
  const owner = await setup.user.findFirst({
    where: { role: "PLATFORM_OWNER", status: "ACTIVE" },
    select: { id: true },
  })
  if (!owner) throw new Error("Seed PLATFORM_OWNER not found. Run `pnpm db:seed` first.")
  const admin = await setup.user.findFirst({
    where: { role: "SUPERADMIN", status: "ACTIVE" },
    select: { id: true },
  })
  if (!admin) throw new Error("Seed SUPERADMIN not found. Run `pnpm db:seed` first.")
  ownerId = owner.id
  customerAdminId = admin.id
  runId = Math.random().toString(36).slice(2, 8).toUpperCase()
})

afterAll(async () => {
  await setup.auditLog.deleteMany({ where: { organizationId: { in: createdOrgIds } } })
  await setup.user.deleteMany({ where: { organizationId: { in: createdOrgIds } } })
  await setup.organization.deleteMany({ where: { id: { in: createdOrgIds } } })
  await setup.$disconnect()
})

describe("createOrganization", () => {
  it("creates the organization, an INVITED SUPERADMIN, and audit rows — but no categories", async () => {
    const { organizationId, inviteToken } = await newOrganization()

    const org = await setup.organization.findUniqueOrThrow({ where: { id: organizationId } })
    expect(org).toMatchObject({
      code: `T-${runId}`,
      timezone: "Asia/Makassar",
      status: "TRIAL",
      quotaStorageBytes: BigInt(20) * BigInt(GB),
    })

    const admin = await setup.user.findFirstOrThrow({ where: { organizationId } })
    expect(admin).toMatchObject({ role: "SUPERADMIN", status: "INVITED" })
    expect(admin.inviteTokenHash).toBe(hashToken(inviteToken))

    expect(await setup.category.count({ where: { organizationId } })).toBe(0)

    const actions = await setup.auditLog.findMany({
      where: { organizationId },
      select: { action: true, actorUserId: true },
    })
    expect(actions.map((a) => a.action).sort()).toEqual([
      "platform.organization.create",
      "user.invite",
    ])
    expect(actions.every((a) => a.actorUserId === ownerId)).toBe(true)
  })

  it("rejects a duplicate code without creating anything", async () => {
    const before = await setup.organization.count()
    await expect(
      createOrganization(ownerId, makeInput({ adminEmail: `other-${runId}@rs-uji.test` })),
    ).rejects.toBeInstanceOf(OperatorError)
    expect(await setup.organization.count()).toBe(before)
  })

  it("reports usage per organization in list and detail", async () => {
    const { organizationId } = await newOrganization({
      code: `U-${runId}`,
      adminEmail: `u-${runId}@rs-uji.test`,
    })
    const listed = (await listOrganizations()).find((o) => o.id === organizationId)
    expect(listed?.usage).toEqual({ assets: 0, users: 1, storageBytes: BigInt(0) })

    const detail = await getOrganization(organizationId)
    expect(detail?.admins).toHaveLength(1)
    expect(detail?.admins[0]?.status).toBe("INVITED")
  })
})

describe("resendAdminInvite", () => {
  it("rotates the token of a pending invite", async () => {
    const { organizationId, inviteToken } = await newOrganization({
      code: `R-${runId}`,
      adminEmail: `r-${runId}@rs-uji.test`,
    })
    const admin = await setup.user.findFirstOrThrow({ where: { organizationId } })
    const { inviteToken: next } = await resendAdminInvite(ownerId, organizationId, admin.id)

    const after = await setup.user.findUniqueOrThrow({ where: { id: admin.id } })
    expect(next).not.toBe(inviteToken)
    expect(after.inviteTokenHash).toBe(hashToken(next))
  })

  it("refuses a user from another organization", async () => {
    const { organizationId } = await newOrganization({
      code: `X-${runId}`,
      adminEmail: `x-${runId}@rs-uji.test`,
    })
    await expect(resendAdminInvite(ownerId, organizationId, customerAdminId)).rejects.toThrow(
      OperatorError,
    )
  })
})

describe("updateOrganization", () => {
  it("records only the fields that changed", async () => {
    const { organizationId } = await newOrganization({
      code: `Q-${runId}`,
      adminEmail: `q-${runId}@rs-uji.test`,
    })
    await updateOrganization(ownerId, organizationId, {
      status: "ACTIVE",
      quotaAssets: 2000,
      quotaStorageGb: 50,
      quotaUsers: 50,
    })

    const org = await setup.organization.findUniqueOrThrow({ where: { id: organizationId } })
    expect(org.status).toBe("ACTIVE")
    expect(org.quotaStorageBytes).toBe(BigInt(50) * BigInt(GB))

    const audit = await setup.auditLog.findFirstOrThrow({
      where: { organizationId, action: "platform.organization.update" },
    })
    expect(audit.changes).toEqual({
      status: { from: "TRIAL", to: "ACTIVE" },
      quotaStorageBytes: { from: 20 * GB, to: 50 * GB },
    })
  })

  it("writes nothing when no field changes", async () => {
    const { organizationId } = await newOrganization({
      code: `N-${runId}`,
      adminEmail: `n-${runId}@rs-uji.test`,
    })
    await updateOrganization(ownerId, organizationId, {
      status: "TRIAL",
      quotaAssets: 2000,
      quotaStorageGb: 20,
      quotaUsers: 50,
    })
    const count = await setup.auditLog.count({
      where: { organizationId, action: "platform.organization.update" },
    })
    expect(count).toBe(0)
  })
})

describe("impersonation", () => {
  it("writes platform.impersonate visible to the customer and yields a scoped session", async () => {
    const { organizationId } = await newOrganization({
      code: `I-${runId}`,
      adminEmail: `i-${runId}@rs-uji.test`,
    })
    const ticket = await startImpersonation(ownerId, organizationId, meta)

    // Seen through the RLS-bound app connection, i.e. what the customer's audit page sees.
    const visible = await withOrg(organizationId, (tx) =>
      tx.auditLog.findFirst({ where: { action: "platform.impersonate", actorUserId: ownerId } }),
    )
    expect(visible).not.toBeNull()
    expect(visible?.ipAddress).toBe("203.0.113.7")

    const session = await redeemTicket(ticket)
    expect(session).toMatchObject({
      id: ownerId,
      role: "PLATFORM_OWNER",
      organizationId,
      impersonating: true,
    })

    const back = await endImpersonation(ownerId, organizationId, meta)
    expect(await redeemTicket(back)).toMatchObject({ organizationId: null, impersonating: false })
    const ended = await setup.auditLog.count({
      where: { organizationId, action: "platform.impersonate.end" },
    })
    expect(ended).toBe(1)
  })

  it("drops an unparseable IP instead of failing the INET insert", async () => {
    const { organizationId } = await newOrganization({
      code: `P-${runId}`,
      adminEmail: `p-${runId}@rs-uji.test`,
    })
    await startImpersonation(ownerId, organizationId, { ipAddress: "unknown", userAgent: null })
    const row = await setup.auditLog.findFirstOrThrow({
      where: { organizationId, action: "platform.impersonate" },
    })
    expect(row.ipAddress).toBeNull()
  })

  it("rejects tampered, retargeted, expired, or non-owner tickets", async () => {
    const { organizationId } = await newOrganization({
      code: `V-${runId}`,
      adminEmail: `v-${runId}@rs-uji.test`,
    })
    const ticket = await startImpersonation(ownerId, organizationId, meta)
    const flipped = ticket.sig.replace(/^./, (c) => (c === "0" ? "1" : "0"))

    expect(await redeemTicket({ ...ticket, sig: flipped })).toBeNull()
    expect(await redeemTicket({ ...ticket, organizationId: "" })).toBeNull()
    expect(await redeemTicket({ ...ticket, exp: String(Number(ticket.exp) + 60) })).toBeNull()
    expect(await redeemTicket({ ...ticket, actorUserId: customerAdminId })).toBeNull()
    expect(await redeemTicket({ ...ticket, sig: "not-hex" })).toBeNull()
    expect(await redeemTicket({})).toBeNull()
  })

  it("rejects a correctly signed ticket whose actor is not an active PLATFORM_OWNER", async () => {
    const { organizationId } = await newOrganization({
      code: `A-${runId}`,
      adminEmail: `a-${runId}@rs-uji.test`,
    })
    const exp = String(Math.floor(Date.now() / 1000) + 60)
    const sig = createHmac("sha256", process.env.AUTH_SECRET ?? "")
      .update(`platform-session:v1:${customerAdminId}:${organizationId}:${exp}`)
      .digest("hex")
    expect(
      await redeemTicket({ actorUserId: customerAdminId, organizationId, exp, sig }),
    ).toBeNull()
  })

  it("rejects an expired ticket even with a valid signature", async () => {
    const realNow = Date.now
    const { organizationId } = await newOrganization({
      code: `E-${runId}`,
      adminEmail: `e-${runId}@rs-uji.test`,
    })
    const ticket = await startImpersonation(ownerId, organizationId, meta)
    try {
      Date.now = () => realNow() + 2 * 60 * 1000
      expect(await redeemTicket(ticket)).toBeNull()
    } finally {
      Date.now = realNow
    }
  })
})

/**
 * The single most important test in this repository (docs/00-README.md §"Ringkasan
 * keputusan yang mengikat", docs/04 ADR-08). SIMASET is a multi-tenant SaaS product:
 * every table that carries `organization_id` MUST be unreadable and unwritable by a
 * session scoped to a different organization, enforced by PostgreSQL Row Level
 * Security — not merely by application-level filtering.
 *
 * This test exercises the real `simaset_app` role (RLS-bound, not BYPASSRLS) through
 * `withOrg()`, the same helper request handlers use. It requires a live Postgres with
 * the initial migration applied and the two-organization seed run
 * (`pnpm db:seed`) — see docs/09-deployment-ops.md.
 */
import { PrismaPg } from "@prisma/adapter-pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { PrismaClient } from "../generated/prisma/client"
import { clearOrg, withOrg } from "../src/server/db"

// Bypasses RLS (role simaset_platform) — used ONLY to look up fixture ids in setup,
// never to make the assertions below. The assertions must go through withOrg().
const setup = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL_PLATFORM ?? process.env.DATABASE_URL ?? "",
  }),
})

let orgA: { id: string; code: string }
let orgB: { id: string; code: string }

beforeAll(async () => {
  const orgs = await setup.organization.findMany({
    where: { code: { in: ["RS01", "RS02"] } },
    select: { id: true, code: true },
  })
  const a = orgs.find((o) => o.code === "RS01")
  const b = orgs.find((o) => o.code === "RS02")
  if (!a || !b) {
    throw new Error(
      "Seed organizations RS01/RS02 not found. Run `pnpm db:seed` against the test database first.",
    )
  }
  orgA = a
  orgB = b

  const [assetsA, assetsB] = await Promise.all([
    setup.asset.count({ where: { organizationId: orgA.id } }),
    setup.asset.count({ where: { organizationId: orgB.id } }),
  ])
  if (assetsA === 0 || assetsB === 0) {
    throw new Error("Seed assets missing for RS01/RS02 — re-run `pnpm db:seed`.")
  }
})

afterAll(async () => {
  await setup.$disconnect()
})

describe("tenant isolation (Row Level Security)", () => {
  it("a session scoped to org A cannot see org B's assets", async () => {
    const seenFromA = await withOrg(orgA.id, (tx) => tx.asset.findMany())
    expect(seenFromA.length).toBeGreaterThan(0)
    expect(seenFromA.every((a) => a.organizationId === orgA.id)).toBe(true)
    expect(seenFromA.some((a) => a.organizationId === orgB.id)).toBe(false)
  })

  it("a session scoped to org B cannot see org A's assets (symmetric)", async () => {
    const seenFromB = await withOrg(orgB.id, (tx) => tx.asset.findMany())
    expect(seenFromB.every((a) => a.organizationId === orgB.id)).toBe(true)
  })

  it("cannot read org B's assets by primary key while scoped to org A", async () => {
    const targetFromOwner = await setup.asset.findFirstOrThrow({
      where: { organizationId: orgB.id },
      select: { id: true },
    })
    const stolen = await withOrg(orgA.id, (tx) =>
      tx.asset.findUnique({ where: { id: targetFromOwner.id } }),
    )
    expect(stolen).toBeNull()
  })

  it("cannot see org B's locations, categories, or users while scoped to org A", async () => {
    const [locations, categories, users] = await withOrg(orgA.id, (tx) =>
      Promise.all([
        tx.location.findMany({ where: { organizationId: orgB.id } }),
        tx.category.findMany({ where: { organizationId: orgB.id } }),
        tx.user.findMany({ where: { organizationId: orgB.id } }),
      ]),
    )
    expect(locations).toHaveLength(0)
    expect(categories).toHaveLength(0)
    expect(users).toHaveLength(0)
  })

  it("cannot insert a row claiming to belong to another organization", async () => {
    // RLS applies to writes too: the row would violate the policy's USING clause
    // and PostgreSQL rejects it (or the row becomes invisible to the writer,
    // depending on WITH CHECK) rather than silently leaking cross-tenant.
    await expect(
      withOrg(orgA.id, (tx) =>
        tx.category.create({
          data: {
            organizationId: orgB.id,
            name: "Kategori bocor",
            isMedicalDevice: false,
          },
        }),
      ),
    ).rejects.toThrow()
  })

  it("without any org scope set, no tenant-carrying table is readable", async () => {
    const rows = await withOrg("", (tx) => tx.asset.findMany({ take: 1 }))
    expect(rows).toHaveLength(0)
  })

  it("app.current_org is transaction-local and does not leak between withOrg calls", async () => {
    const firstCall = await withOrg(orgA.id, (tx) => tx.asset.findMany())
    expect(firstCall.every((a) => a.organizationId === orgA.id)).toBe(true)

    const secondCall = await withOrg(orgB.id, (tx) => tx.asset.findMany())
    expect(secondCall.every((a) => a.organizationId === orgB.id)).toBe(true)
  })
})

describe("append-only asset_events", () => {
  it("UPDATE on asset_events is a silent no-op at the database level, not just blocked in app code", async () => {
    const before = await withOrg(orgA.id, (tx) =>
      tx.assetEvent.findFirstOrThrow({ where: { organizationId: orgA.id } }),
    )

    await withOrg(orgA.id, (tx) =>
      tx.$executeRawUnsafe(
        `UPDATE asset_events SET title = 'DIUBAH PAKSA' WHERE id = $1`,
        before.id,
      ),
    )

    const after = await withOrg(orgA.id, (tx) =>
      tx.assetEvent.findUniqueOrThrow({ where: { id: before.id } }),
    )
    expect(after.title).toBe(before.title)
    expect(after.title).not.toBe("DIUBAH PAKSA")
  })

  it("DELETE on asset_events is a silent no-op at the database level", async () => {
    const before = await withOrg(orgA.id, (tx) =>
      tx.assetEvent.findFirstOrThrow({ where: { organizationId: orgA.id } }),
    )

    await withOrg(orgA.id, (tx) =>
      tx.$executeRawUnsafe(`DELETE FROM asset_events WHERE id = $1`, before.id),
    )

    const stillThere = await withOrg(orgA.id, (tx) =>
      tx.assetEvent.findUnique({ where: { id: before.id } }),
    )
    expect(stillThere).not.toBeNull()
  })
})

describe("clearOrg", () => {
  it("resets app.current_org so a leaked handle cannot be reused across requests", async () => {
    await withOrg(orgA.id, async (tx) => {
      await clearOrg(tx)
      const rows = await tx.asset.findMany({ take: 1 })
      expect(rows).toHaveLength(0)
    })
  })
})

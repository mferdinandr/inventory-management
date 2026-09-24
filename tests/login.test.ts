/**
 * Regression test for a bug that made login impossible: auth.ts's authorize()
 * originally queried the RLS-bound `db` client to find a user by email, but
 * at login time no organization is known yet — app.current_org is unset, so
 * the RLS policy's fallback (COALESCE ... zero UUID) matches nothing and
 * every login attempt silently found zero rows. Caught manually with a
 * throwaway probe script; this test is that probe made permanent.
 */

import { PrismaPg } from "@prisma/adapter-pg"
import { beforeAll, describe, expect, it } from "vitest"
import { PrismaClient } from "../generated/prisma/client"
import { verifyCredentials } from "../src/server/services/credentials.service"

const setup = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL_PLATFORM ?? process.env.DATABASE_URL ?? "",
  }),
})

let seededEmail: string

beforeAll(async () => {
  const admin = await setup.user.findFirst({
    where: { role: "SUPERADMIN", status: "ACTIVE", passwordHash: { not: null } },
    select: { email: true },
  })
  if (!admin) {
    throw new Error("No active SUPERADMIN in the seed — run `pnpm db:seed` first.")
  }
  seededEmail = admin.email
})

describe("verifyCredentials (login)", () => {
  it("resolves a real user with the correct password, before any org context exists", async () => {
    const user = await verifyCredentials(seededEmail, "simaset-demo-2026")
    expect(user).not.toBeNull()
    expect(user?.email).toBe(seededEmail)
    expect(user?.status).toBe("ACTIVE")
  })

  it("email lookup is case-insensitive and trims whitespace", async () => {
    const user = await verifyCredentials(`  ${seededEmail.toUpperCase()}  `, "simaset-demo-2026")
    expect(user).not.toBeNull()
  })

  it("rejects a wrong password", async () => {
    const user = await verifyCredentials(seededEmail, "definitely-not-the-password")
    expect(user).toBeNull()
  })

  it("rejects an unknown email", async () => {
    const user = await verifyCredentials("nobody@nowhere.test", "anything")
    expect(user).toBeNull()
  })

  it("rejects empty credentials without querying the database", async () => {
    expect(await verifyCredentials("", "")).toBeNull()
    expect(await verifyCredentials(seededEmail, "")).toBeNull()
  })
})

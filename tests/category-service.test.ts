/**
 * Integration tests for src/server/services/category.service.ts, exercising the real
 * simaset_app role (RLS-bound, same as request handlers use) against the seeded
 * development database (docs/09-deployment-ops.md). Covers FR-03 rules: two-level
 * nesting, unique sibling names, medical-device calibration interval, soft-deactivate,
 * and audit logging — the regressions the PR review caught.
 */
import { PrismaPg } from "@prisma/adapter-pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { PrismaClient } from "../generated/prisma/client"
import { withOrg } from "../src/server/db"
import {
  CategoryError,
  type CategoryInput,
  createCategory,
  setCategoryActive,
  updateCategory,
} from "../src/server/services/category.service"

// Bypasses RLS (role simaset_platform) — used ONLY for fixture lookup and cleanup,
// never for the assertions below..
const setup = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL_PLATFORM ?? process.env.DATABASE_URL ?? "",
  }),
})

let orgA: { id: string }
let actorId: string
let runId: string
const ids: string[] = []

function uniqueName(label: string): string {
  return `${label}-${runId}`
}

function makeInput(overrides: Partial<CategoryInput> = {}): CategoryInput {
  return {
    name: uniqueName("Kategori"),
    code: null,
    parentId: null,
    isMedicalDevice: false,
    defaultCalibrationIntervalMonths: null,
    ...overrides,
  }
}

async function findById(id: string) {
  return withOrg(orgA.id, (tx) => tx.category.findUnique({ where: { id } }))
}

async function auditAction(categoryId: string, action: string) {
  return withOrg(orgA.id, (tx) =>
    tx.auditLog.findFirst({
      where: { entityType: "category", entityId: categoryId, action },
      select: { id: true },
    }),
  )
}

beforeAll(async () => {
  const orgs = await setup.organization.findMany({
    where: { code: "RS01" },
    select: { id: true },
  })
  const org = orgs[0]
  if (!org) throw new Error("Seed organization RS01 not found. Run `pnpm db:seed` first.")
  const admin = await setup.user.findFirst({
    where: { organizationId: org.id, role: "SUPERADMIN" },
    select: { id: true },
  })
  if (!admin) throw new Error("Seed SUPERADMIN for RS01 not found. Run `pnpm db:seed` first.")
  orgA = { id: org.id }
  actorId = admin.id
  runId = Math.random().toString(36).slice(2, 8)
})

afterAll(async () => {
  await setup.category.deleteMany({ where: { parentId: { in: ids } } })
  await setup.category.deleteMany({ where: { id: { in: ids } } })
  await setup.auditLog.deleteMany({ where: { entityType: "category", entityId: { in: ids } } })
  await setup.$disconnect()
})

describe("category.service (FR-03)", () => {
  it("creates a top-level category and records an audit log", async () => {
    const name = uniqueName("Ventilator")
    const created = await createCategory(
      orgA.id,
      actorId,
      makeInput({
        name,
        code: "VEN",
        isMedicalDevice: true,
        defaultCalibrationIntervalMonths: 12,
      }),
    )
    ids.push(created.id)

    const row = await findById(created.id)
    expect(row?.name).toBe(name)
    expect(row?.isMedicalDevice).toBe(true)
    expect(row?.defaultCalibrationIntervalMonths).toBe(12)
    expect(await auditAction(created.id, "category.create")).not.toBeNull()
  })

  it("rejects a duplicate sibling name at the same level", async () => {
    const name = uniqueName("Duplikat")
    const first = await createCategory(orgA.id, actorId, makeInput({ name }))
    ids.push(first.id)

    await expect(createCategory(orgA.id, actorId, makeInput({ name }))).rejects.toThrow(
      CategoryError,
    )
  })

  it("rejects nesting deeper than two levels", async () => {
    const parent = await createCategory(orgA.id, actorId, makeInput({ name: uniqueName("Induk") }))
    ids.push(parent.id)
    const child = await createCategory(
      orgA.id,
      actorId,
      makeInput({ name: uniqueName("Anak"), parentId: parent.id }),
    )
    ids.push(child.id)

    await expect(
      createCategory(orgA.id, actorId, makeInput({ name: uniqueName("Cucu"), parentId: child.id })),
    ).rejects.toThrow(/dua tingkat/)
  })

  it("updates a category, records an audit log, and rejects self-parent", async () => {
    const parent = await createCategory(
      orgA.id,
      actorId,
      makeInput({ name: uniqueName("Induk-Ubah") }),
    )
    ids.push(parent.id)
    const child = await createCategory(
      orgA.id,
      actorId,
      makeInput({
        name: uniqueName("Anak-Ubah"),
        parentId: parent.id,
      }),
    )
    ids.push(child.id)

    const newName = uniqueName("Anak-Ubah-Baru")
    await updateCategory(
      orgA.id,
      actorId,
      child.id,
      makeInput({
        name: newName,
        parentId: parent.id,
      }),
    )
    expect((await findById(child.id))?.name).toBe(newName)
    expect(await auditAction(child.id, "category.update")).not.toBeNull()

    await expect(
      updateCategory(orgA.id, actorId, parent.id, makeInput({ parentId: parent.id })),
    ).rejects.toThrow(/dirinya sendiri/)
  })

  it("disables and re-enables, and blocks deactivating a parent with children", async () => {
    const parent = await createCategory(
      orgA.id,
      actorId,
      makeInput({ name: uniqueName("Induk-Aktif") }),
    )
    ids.push(parent.id)

    await setCategoryActive(orgA.id, actorId, parent.id, false)
    expect((await findById(parent.id))?.isActive).toBe(false)
    expect(await auditAction(parent.id, "category.disable")).not.toBeNull()

    const child = await createCategory(
      orgA.id,
      actorId,
      makeInput({ name: uniqueName("Anak-Aktif"), parentId: parent.id }),
    )
    ids.push(child.id)

    await expect(setCategoryActive(orgA.id, actorId, parent.id, false)).rejects.toThrow(/anak/)

    await setCategoryActive(orgA.id, actorId, parent.id, true)
    expect((await findById(parent.id))?.isActive).toBe(true)
    expect(await auditAction(parent.id, "category.enable")).not.toBeNull()
  })
})

import { PrismaPg } from "@prisma/adapter-pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { PrismaClient } from "../generated/prisma/client"
import { assertParentType, childPath, subtreePrefix } from "../src/lib/location"
import {
  createLocation,
  listLocations,
  updateLocation,
} from "../src/server/services/location.service"

const setup = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL_PLATFORM ?? process.env.DATABASE_URL ?? "",
  }),
})

let orgId: string
let actorId: string
const roots: string[] = []

async function deleteDeep(id: string) {
  const children = await setup.location.findMany({ where: { parentId: id }, select: { id: true } })
  for (const child of children) await deleteDeep(child.id)
  await setup.location.delete({ where: { id } })
}

beforeAll(async () => {
  const org = await setup.organization.findFirstOrThrow({
    where: { code: "RS01" },
    select: { id: true },
  })
  orgId = org.id
  const actor = await setup.user.findFirstOrThrow({
    where: { organizationId: orgId, role: "SUPERADMIN" },
    select: { id: true },
  })
  actorId = actor.id
})

afterAll(async () => {
  for (const id of roots.reverse()) {
    await deleteDeep(id)
  }
  await setup.$disconnect()
})

function locId(result: Awaited<ReturnType<typeof createLocation>>): string {
  if (!result.ok) throw new Error(result.error)
  return result.data.id
}

describe("pure path helpers", () => {
  it("subtreePrefix builds the ancestor-chain prefix", () => {
    expect(subtreePrefix("", "a1")).toBe("a1")
    expect(subtreePrefix("a1/a2", "a3")).toBe("a1/a2/a3")
  })

  it("childPath roots to empty and joins parent chain otherwise", () => {
    expect(childPath(null)).toBe("")
    expect(childPath({ path: "", id: "b1" })).toBe("b1")
    expect(childPath({ path: "b1", id: "f1" })).toBe("b1/f1")
  })

  it("assertParentType follows the four-level rule", () => {
    expect(assertParentType("BUILDING", null)).toBeNull()
    expect(assertParentType("FLOOR", null)).not.toBeNull()
    expect(assertParentType("FLOOR", "BUILDING")).toBeNull()
    expect(assertParentType("DEPARTMENT", "FLOOR")).toBeNull()
    expect(assertParentType("ROOM", "DEPARTMENT")).toBeNull()
    expect(assertParentType("ROOM", "BUILDING")).not.toBeNull()
    expect(assertParentType("FLOOR", "FLOOR")).not.toBeNull()
  })
})

describe("location hierarchy service", () => {
  it("creates a four-level tree and maintains path columns", async () => {
    const bId = locId(
      await createLocation({
        organizationId: orgId,
        actorId,
        data: { type: "BUILDING", name: "Gedung Tes A", code: "GTA" },
      }),
    )
    roots.push(bId)
    const fId = locId(
      await createLocation({
        organizationId: orgId,
        actorId,
        data: { type: "FLOOR", name: "Lantai Tes 1", parentId: bId },
      }),
    )
    const dId = locId(
      await createLocation({
        organizationId: orgId,
        actorId,
        data: { type: "DEPARTMENT", name: "Instalasi Tes", code: "ITES", parentId: fId },
      }),
    )
    const rId = locId(
      await createLocation({
        organizationId: orgId,
        actorId,
        data: { type: "ROOM", name: "Ruang Tes 1", parentId: dId },
      }),
    )

    const all = await listLocations(orgId)

    expect(all.find((l) => l.id === bId)?.path).toBe("")
    expect(all.find((l) => l.id === fId)?.path).toBe(bId)
    expect(all.find((l) => l.id === dId)?.path).toBe(`${bId}/${fId}`)
    expect(all.find((l) => l.id === rId)?.path).toBe(`${bId}/${fId}/${dId}`)
    expect(all.find((l) => l.id === rId)?.breadcrumb).toEqual([
      "Gedung Tes A",
      "Lantai Tes 1",
      "Instalasi Tes",
      "Ruang Tes 1",
    ])
  })

  it("rejects a ROOM without a parent", async () => {
    const res = await createLocation({
      organizationId: orgId,
      actorId,
      data: { type: "ROOM", name: "Ruang Nyasar" },
    })
    expect(res.ok).toBe(false)
  })

  it("rejects an unknown parent", async () => {
    const res = await createLocation({
      organizationId: orgId,
      actorId,
      data: {
        type: "FLOOR",
        name: "Lantai Hantu",
        parentId: "00000000-0000-0000-0000-000000000000",
      },
    })
    expect(res.ok).toBe(false)
  })

  it("moves a subtree and rewrites descendant paths", async () => {
    const b1 = locId(
      await createLocation({
        organizationId: orgId,
        actorId,
        data: { type: "BUILDING", name: "Gedung Tes Pindah" },
      }),
    )
    roots.push(b1)
    const f1 = locId(
      await createLocation({
        organizationId: orgId,
        actorId,
        data: { type: "FLOOR", name: "Lantai Asal", parentId: b1 },
      }),
    )
    const d1 = locId(
      await createLocation({
        organizationId: orgId,
        actorId,
        data: { type: "DEPARTMENT", name: "Instalasi Pindah", parentId: f1 },
      }),
    )
    const r1 = locId(
      await createLocation({
        organizationId: orgId,
        actorId,
        data: { type: "ROOM", name: "Ruang Pindah", parentId: d1 },
      }),
    )

    const b2 = locId(
      await createLocation({
        organizationId: orgId,
        actorId,
        data: { type: "BUILDING", name: "Gedung Tujuan" },
      }),
    )
    roots.push(b2)
    const f2 = locId(
      await createLocation({
        organizationId: orgId,
        actorId,
        data: { type: "FLOOR", name: "Lantai Tujuan", parentId: b2 },
      }),
    )

    const moved = await updateLocation({
      organizationId: orgId,
      actorId,
      id: d1,
      data: { parentId: f2 },
    })
    expect(moved.ok).toBe(true)

    const all = await listLocations(orgId)
    expect(all.find((l) => l.id === d1)?.path).toBe(`${b2}/${f2}`)
    expect(all.find((l) => l.id === r1)?.path).toBe(`${b2}/${f2}/${d1}`)
    expect(all.find((l) => l.id === f1)?.path).toBe(b1)
  })

  it("deactivates a location", async () => {
    const bId = locId(
      await createLocation({
        organizationId: orgId,
        actorId,
        data: { type: "BUILDING", name: "Gedung Nonaktif" },
      }),
    )
    roots.push(bId)
    const deact = await updateLocation({
      organizationId: orgId,
      actorId,
      id: bId,
      data: { isActive: false },
    })
    expect(deact.ok).toBe(true)
    expect((await listLocations(orgId)).find((l) => l.id === bId)?.isActive).toBe(false)
  })

  it("assigns a PIC only to ROOM locations", async () => {
    const bId = locId(
      await createLocation({
        organizationId: orgId,
        actorId,
        data: { type: "BUILDING", name: "Gedung Ber-PIC" },
      }),
    )
    roots.push(bId)
    const fId = locId(
      await createLocation({
        organizationId: orgId,
        actorId,
        data: { type: "FLOOR", name: "Lantai PIC", parentId: bId },
      }),
    )
    const dId = locId(
      await createLocation({
        organizationId: orgId,
        actorId,
        data: { type: "DEPARTMENT", name: "Instalasi PIC", parentId: fId },
      }),
    )
    const rId = locId(
      await createLocation({
        organizationId: orgId,
        actorId,
        data: { type: "ROOM", name: "Ruang Ber-PIC", parentId: dId },
      }),
    )

    const ok = await updateLocation({
      organizationId: orgId,
      actorId,
      id: rId,
      data: { picUserId: actorId },
    })
    expect(ok.ok).toBe(true)
    expect((await listLocations(orgId)).find((l) => l.id === rId)?.picUserId).toBe(actorId)

    const wrongType = await updateLocation({
      organizationId: orgId,
      actorId,
      id: bId,
      data: { picUserId: actorId },
    })
    expect(wrongType.ok).toBe(false)

    const bad = await updateLocation({
      organizationId: orgId,
      actorId,
      id: rId,
      data: { picUserId: "00000000-0000-0000-0000-000000000000" },
    })
    expect(bad.ok).toBe(false)
  })
})

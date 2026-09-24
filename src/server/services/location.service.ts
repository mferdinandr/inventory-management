import "server-only"
import { assertParentType, childPath, subtreePrefix } from "@/lib/location"
import type { CreateLocationInput, UpdateLocationInput } from "@/lib/validators/location"
import type { Prisma } from "../../../generated/prisma/client"
import type { LocationType } from "../../../generated/prisma/enums"
import { withOrg } from "../db"
import { assertOrgWritable } from "../quota"

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

export type LocationListItem = {
  id: string
  parentId: string | null
  type: LocationType
  name: string
  code: string | null
  picUserId: string | null
  picName: string | null
  path: string
  isActive: boolean
  breadcrumb: string[]
  depth: number
}

export async function listLocations(organizationId: string): Promise<LocationListItem[]> {
  return withOrg(organizationId, async (tx) => {
    const rows = await tx.location.findMany({
      where: { organizationId },
      include: { picUser: { select: { id: true, name: true } } },
    })

    const byId = new Map(rows.map((row) => [row.id, row]) as Array<[string, (typeof rows)[number]]>)
    const items = rows.map<LocationListItem>((row) => {
      const breadcrumb: string[] = []
      let cursor: (typeof rows)[number] | null = row
      let guard = 0
      while (cursor && guard < 16) {
        breadcrumb.unshift(cursor.name)
        cursor = cursor.parentId ? (byId.get(cursor.parentId) ?? null) : null
        guard++
      }
      return {
        id: row.id,
        parentId: row.parentId,
        type: row.type,
        name: row.name,
        code: row.code,
        picUserId: row.picUserId,
        picName: row.picUser?.name ?? null,
        path: row.path,
        isActive: row.isActive,
        breadcrumb,
        depth: breadcrumb.length - 1,
      }
    })

    const ordered: LocationListItem[] = []
    const childrenByParent = new Map<string | null, LocationListItem[]>()
    for (const item of items) {
      const siblings = childrenByParent.get(item.parentId) ?? []
      siblings.push(item)
      childrenByParent.set(item.parentId, siblings)
    }
    const visit = (nodes: LocationListItem[]) => {
      for (const node of nodes.sort((a, b) => a.name.localeCompare(b.name, "id"))) {
        ordered.push(node)
        visit(childrenByParent.get(node.id) ?? [])
      }
    }
    visit(childrenByParent.get(null) ?? [])
    return ordered
  })
}

export async function listPicCandidates(
  organizationId: string,
): Promise<Array<{ id: string; name: string }>> {
  return withOrg(organizationId, (tx) =>
    tx.user.findMany({
      where: { organizationId, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  )
}

export async function createLocation(args: {
  organizationId: string
  actorId: string
  data: CreateLocationInput
}): Promise<ActionResult<{ id: string; path: string }>> {
  return withOrg(args.organizationId, async (tx) => {
    await assertOrgWritable(args.organizationId, tx)
    const parent = await resolveParent(tx, args.data.parentId)
    if (parent.error) return { ok: false, error: parent.error }

    const typeError = assertParentType(args.data.type, parent.row?.type ?? null)
    if (typeError) return { ok: false, error: typeError }

    if ((args.data.picUserId ?? null) !== null && args.data.type !== "ROOM") {
      return { ok: false, error: "PIC hanya dapat ditetapkan untuk lokasi bertipe Ruangan." }
    }

    const pic = await resolvePicUser(tx, args.data.picUserId ?? null)
    if (pic.error) return { ok: false, error: pic.error }

    const path = childPath(parent.row)
    const created = await tx.location.create({
      data: {
        organizationId: args.organizationId,
        parentId: parent.row?.id ?? null,
        type: args.data.type,
        name: args.data.name,
        code: args.data.code ?? null,
        picUserId: pic.picUserId,
        path,
        isActive: true,
      },
    })

    await writeAuditLog(tx, {
      organizationId: args.organizationId,
      actorUserId: args.actorId,
      action: "location.create",
      entityType: "location",
      entityId: created.id,
      changes: {
        name: created.name,
        type: created.type,
        parentId: created.parentId,
        code: created.code,
        picUserId: created.picUserId,
        path: created.path,
      } as Prisma.InputJsonValue,
    })

    return { ok: true, data: { id: created.id, path: created.path } }
  })
}

export async function updateLocation(args: {
  organizationId: string
  actorId: string
  id: string
  data: UpdateLocationInput
}): Promise<ActionResult<{ id: string }>> {
  return withOrg(args.organizationId, async (tx) => {
    await assertOrgWritable(args.organizationId, tx)
    const current = await tx.location.findUnique({ where: { id: args.id } })
    if (!current) return { ok: false, error: "Lokasi tidak ditemukan." }

    const updates: Prisma.LocationUncheckedUpdateInput = {}
    const changes: Record<string, { from: unknown; to: unknown }> = {}

    if (args.data.name !== undefined && args.data.name !== current.name) {
      updates.name = args.data.name
      changes.name = { from: current.name, to: args.data.name }
    }

    if (args.data.code !== undefined && (args.data.code ?? null) !== current.code) {
      const code = args.data.code ?? null
      updates.code = code
      changes.code = { from: current.code, to: code }
    }

    if (args.data.picUserId !== undefined) {
      if ((args.data.picUserId ?? null) !== null && current.type !== "ROOM") {
        return { ok: false, error: "PIC hanya dapat ditetapkan untuk lokasi bertipe Ruangan." }
      }
      const pic = await resolvePicUser(tx, args.data.picUserId ?? null)
      if (pic.error) return { ok: false, error: pic.error }
      if (pic.picUserId !== current.picUserId) {
        updates.picUserId = pic.picUserId
        changes.picUserId = { from: current.picUserId, to: pic.picUserId }
      }
    }

    if (args.data.isActive !== undefined && args.data.isActive !== current.isActive) {
      updates.isActive = args.data.isActive
      changes.isActive = { from: current.isActive, to: args.data.isActive }
    }

    if (args.data.parentId !== undefined && (args.data.parentId ?? null) !== current.parentId) {
      const parent = await resolveParent(tx, args.data.parentId)
      if (parent.error) return { ok: false, error: parent.error }

      const typeError = assertParentType(current.type, parent.row?.type ?? null)
      if (typeError) return { ok: false, error: typeError }

      const oldPrefix = subtreePrefix(current.path, current.id)
      const newPath = childPath(parent.row)
      const newPrefix = subtreePrefix(newPath, current.id)

      updates.parentId = parent.row?.id ?? null
      updates.path = newPath
      changes.parentId = { from: current.parentId, to: parent.row?.id ?? null }
      changes.path = { from: current.path, to: newPath }

      await rewriteDescendantPaths(tx, oldPrefix, newPrefix)
    }

    if (Object.keys(updates).length === 0) {
      return { ok: true, data: { id: current.id } }
    }

    await tx.location.update({
      where: { id: current.id },
      data: updates,
    })

    await writeAuditLog(tx, {
      organizationId: args.organizationId,
      actorUserId: args.actorId,
      action: "location.update",
      entityType: "location",
      entityId: current.id,
      changes: changes as Prisma.InputJsonValue,
    })

    return { ok: true, data: { id: current.id } }
  })
}

async function resolveParent(
  tx: Prisma.TransactionClient,
  parentId: string | null | undefined,
): Promise<{ row: { id: string; type: LocationType; path: string } | null; error?: string }> {
  if (parentId === null || parentId === undefined) return { row: null }
  const parent = await tx.location.findUnique({
    where: { id: parentId },
    select: { id: true, type: true, path: true },
  })
  if (!parent) return { row: null, error: "Induk lokasi tidak ditemukan." }
  return { row: parent }
}

async function resolvePicUser(
  tx: Prisma.TransactionClient,
  picUserId: string | null,
): Promise<{ picUserId: string | null; error?: string }> {
  if (picUserId === null) return { picUserId: null }
  const user = await tx.user.findFirst({ where: { id: picUserId }, select: { id: true } })
  if (!user) return { picUserId: null, error: "Pengguna PIC tidak ditemukan." }
  return { picUserId }
}

async function rewriteDescendantPaths(
  tx: Prisma.TransactionClient,
  oldPrefix: string,
  newPrefix: string,
) {
  if (oldPrefix === newPrefix) return
  const descendants = await tx.location.findMany({
    where: { OR: [{ path: oldPrefix }, { path: { startsWith: `${oldPrefix}/` } }] },
    select: { id: true, path: true },
  })
  for (const descendant of descendants) {
    await tx.location.update({
      where: { id: descendant.id },
      data: { path: newPrefix + descendant.path.slice(oldPrefix.length) },
    })
  }
}

async function writeAuditLog(
  tx: Prisma.TransactionClient,
  args: {
    organizationId: string
    actorUserId: string
    action: string
    entityType: string
    entityId: string
    changes: Prisma.InputJsonValue
  },
) {
  await tx.auditLog.create({ data: args })
}

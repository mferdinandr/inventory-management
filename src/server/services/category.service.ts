import "server-only"
import { withOrg } from "@/server/db"
import type { Prisma } from "../../../generated/prisma/client"

// FR-03 (docs/02-prd.md): kategori bersusun dua tingkat dan menandai apakah
// satu kategori termasuk alat medis. Seluruh mutasi berjalan di dalam withOrg()
// agar tunduk RLS. Setiap perubahan master data dicatat di audit_logs (docs/03-erd.md §3.14).

export class CategoryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CategoryError"
  }
}

export type CategoryInput = {
  name: string
  code: string | null
  parentId: string | null
  isMedicalDevice: boolean
  defaultCalibrationIntervalMonths: number | null
}

type Tx = Prisma.TransactionClient

async function assertSiblingsUnique(
  tx: Tx,
  organizationId: string,
  parentId: string | null,
  name: string,
  excludeId?: string,
): Promise<void> {
  const sibling = await tx.category.findFirst({
    where: {
      organizationId,
      parentId,
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  })
  if (sibling) {
    throw new CategoryError(`Sudah ada kategori "${name}" di tingkat ini.`)
  }
}

async function assertParentValid(
  tx: Tx,
  organizationId: string,
  parentId: string | null,
): Promise<void> {
  if (!parentId) return
  const parent = await tx.category.findFirst({
    where: { id: parentId, organizationId },
    select: { parentId: true },
  })
  if (!parent) throw new CategoryError("Kategori induk tidak ditemukan.")
  if (parent.parentId) throw new CategoryError("Kategori hanya boleh bersusun dua tingkat.")
}

function auditData(
  action: string,
  changes: Record<string, unknown>,
  input: { organizationId: string; actorId: string; categoryId: string },
): Prisma.Args<"auditLog", "create">["data"] {
  return {
    organizationId: input.organizationId,
    actorUserId: input.actorId,
    action,
    entityType: "category",
    entityId: input.categoryId,
    changes: changes as Prisma.InputJsonValue,
  }
}

export async function createCategory(
  organizationId: string,
  actorUserId: string,
  input: CategoryInput,
): Promise<{ id: string }> {
  return withOrg(organizationId, async (tx) => {
    await assertSiblingsUnique(tx, organizationId, input.parentId, input.name)
    await assertParentValid(tx, organizationId, input.parentId)

    const category = await tx.category.create({
      data: {
        organizationId,
        parentId: input.parentId,
        name: input.name,
        code: input.code,
        isMedicalDevice: input.isMedicalDevice,
        defaultCalibrationIntervalMonths: input.isMedicalDevice
          ? input.defaultCalibrationIntervalMonths
          : null,
      },
      select: { id: true },
    })

    await tx.auditLog.create(
      auditData(
        "category.create",
        { name: input.name },
        {
          organizationId,
          actorId: actorUserId,
          categoryId: category.id,
        },
      ),
    )

    return category
  })
}

export async function updateCategory(
  organizationId: string,
  actorUserId: string,
  categoryId: string,
  input: CategoryInput,
): Promise<void> {
  return withOrg(organizationId, async (tx) => {
    const existing = await tx.category.findFirst({
      where: { id: categoryId, organizationId },
      include: { children: { select: { id: true } } },
    })
    if (!existing) throw new CategoryError("Kategori tidak ditemukan.")

    const movingUnderAnotherParent = input.parentId !== null && input.parentId !== existing.parentId
    if (movingUnderAnotherParent && existing.children.length > 0) {
      throw new CategoryError(
        "Kategori yang memiliki anak tidak dapat dipindahkan ke kategori lain.",
      )
    }

    await assertSiblingsUnique(tx, organizationId, input.parentId, input.name, categoryId)
    await assertParentValid(tx, organizationId, input.parentId)

    const before = await tx.category.update({
      where: { id: categoryId },
      data: {
        parentId: input.parentId,
        name: input.name,
        code: input.code,
        isMedicalDevice: input.isMedicalDevice,
        defaultCalibrationIntervalMonths: input.isMedicalDevice
          ? input.defaultCalibrationIntervalMonths
          : null,
      },
    })

    await tx.auditLog.create(
      auditData(
        "category.update",
        {
          name: { before: existing.name, after: before.name },
          isMedicalDevice: { before: existing.isMedicalDevice, after: before.isMedicalDevice },
        },
        { organizationId, actorId: actorUserId, categoryId },
      ),
    )
  })
}

export async function setCategoryActive(
  organizationId: string,
  actorUserId: string,
  categoryId: string,
  isActive: boolean,
): Promise<void> {
  return withOrg(organizationId, async (tx) => {
    const existing = await tx.category.findFirst({
      where: { id: categoryId, organizationId },
      include: { children: { select: { id: true } } },
    })
    if (!existing) throw new CategoryError("Kategori tidak ditemukan.")
    if (!isActive && existing.children.length > 0) {
      throw new CategoryError("Kategori yang masih memiliki anak tidak dapat dinonaktifkan.")
    }

    const updated = await tx.category.update({
      where: { id: categoryId },
      data: { isActive },
      select: { isActive: true },
    })

    await tx.auditLog.create(
      auditData(
        isActive ? "category.enable" : "category.disable",
        {
          isActive: { before: existing.isActive, after: updated.isActive },
        },
        { organizationId, actorId: actorUserId, categoryId },
      ),
    )
  })
}

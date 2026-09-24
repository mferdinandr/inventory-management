import { CategoryEmptyGuide } from "@/components/categories/category-empty-guide"
import { CategoryFormDialog } from "@/components/categories/category-form"
import { CategoryTable, type CategoryView } from "@/components/categories/category-table"
import { hasPermission } from "@/lib/permissions"
import { withOrg } from "@/server/db"
import { requireActiveOrg, requireUser } from "@/server/tenant"

export const dynamic = "force-dynamic"

type CategoryRow = {
  id: string
  name: string
  code: string | null
  isMedicalDevice: boolean
  defaultCalibrationIntervalMonths: number | null
  isActive: boolean
  parentId: string | null
  assetCount: number
}

function toView(row: CategoryRow, children: CategoryView[] = []): CategoryView {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    isMedicalDevice: row.isMedicalDevice,
    defaultCalibrationIntervalMonths: row.defaultCalibrationIntervalMonths,
    isActive: row.isActive,
    parentId: row.parentId,
    assetCount: row.assetCount,
    children,
  }
}

export default async function CategoriesPage() {
  const user = await requireUser()
  const organizationId = await requireActiveOrg()
  const canManage = hasPermission(user.role, "master:manage")

  const rows = await withOrg(organizationId, (tx) =>
    tx.category.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        code: true,
        isMedicalDevice: true,
        defaultCalibrationIntervalMonths: true,
        isActive: true,
        parentId: true,
        _count: { select: { assets: true } },
        children: {
          select: {
            id: true,
            name: true,
            code: true,
            isMedicalDevice: true,
            defaultCalibrationIntervalMonths: true,
            isActive: true,
            parentId: true,
            _count: { select: { assets: true } },
          },
          orderBy: { name: "asc" },
        },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
  )

  const topLevel: CategoryView[] = []
  const parentById = new Map<string, CategoryView>()
  const childrenLeftOver: CategoryView[] = []
  for (const row of rows) {
    const view = toView(
      { ...row, assetCount: row._count.assets },
      row.children.map((child) => toView({ ...child, assetCount: child._count.assets })),
    )
    if (!view.parentId) {
      topLevel.push(view)
      parentById.set(view.id, view)
    } else {
      childrenLeftOver.push(view)
    }
  }
  for (const child of childrenLeftOver) {
    const parent = parentById.get(child.parentId!)
    if (parent) parent.children.push(child)
    else topLevel.push(child)
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Kategori Aset</h1>
          <p className="text-sm text-muted-foreground">
            Pengelompokan aset, penanda alat medis, dan interval kalibrasi bawaan.
          </p>
        </div>
        {canManage ? <CategoryFormDialog mode="create" topLevel={topLevel} /> : null}
      </header>

      {topLevel.length === 0 ? (
        <CategoryEmptyGuide canManage={canManage} />
      ) : (
        <CategoryTable categories={topLevel} canManage={canManage} topLevel={topLevel} />
      )}
    </div>
  )
}

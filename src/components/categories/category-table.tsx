"use client"

import { useRouter } from "next/navigation"
import { type ReactNode, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { setCategoryActiveAction } from "@/server/actions/category.actions"
import { CategoryFormDialog } from "./category-form"

export type CategoryView = {
  id: string
  name: string
  code: string | null
  isMedicalDevice: boolean
  defaultCalibrationIntervalMonths: number | null
  isActive: boolean
  parentId: string | null
  assetCount: number
  children: CategoryView[]
}

export function CategoryTable({
  categories,
  canManage,
  topLevel,
}: {
  categories: CategoryView[]
  canManage: boolean
  topLevel: CategoryView[]
}) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleToggle(category: CategoryView) {
    setActionError(null)
    setPendingId(category.id)
    const res = await setCategoryActiveAction(category.id, !category.isActive)
    setPendingId(null)
    if (!res.ok) {
      setActionError(res.error)
      return
    }
    router.refresh()
  }

  function renderRow(category: CategoryView, depth: 0 | 1) {
    return (
      <TableRow key={category.id} className={!category.isActive ? "opacity-55" : undefined}>
        <TableCell>
          <div
            className={
              depth === 0
                ? "flex items-center gap-2 font-medium"
                : "flex items-center gap-2 pl-6 font-medium"
            }
          >
            {depth === 1 ? <span className="text-muted-foreground">└</span> : null}
            <span>{category.name}</span>
            {category.code ? (
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {category.code}
              </span>
            ) : null}
            {!category.isActive ? <Badge variant="outline">Nonaktif</Badge> : null}
          </div>
        </TableCell>
        <TableCell>
          <Badge variant={category.isMedicalDevice ? "default" : "secondary"}>
            {category.isMedicalDevice ? "Alat medis" : "Non-medis"}
          </Badge>
        </TableCell>
        <TableCell className="text-muted-foreground">
          {category.defaultCalibrationIntervalMonths
            ? `${category.defaultCalibrationIntervalMonths} bulan`
            : "—"}
        </TableCell>
        <TableCell className="text-muted-foreground">{category.assetCount}</TableCell>
        {canManage ? (
          <TableCell>
            <div className="flex items-center gap-1">
              <CategoryFormDialog mode="edit" category={category} topLevel={topLevel} />
              <Button
                variant="outline"
                size="sm"
                disabled={
                  pendingId === category.id || (category.isActive && category.children.length > 0)
                }
                title={
                  category.isActive && category.children.length > 0
                    ? "Nonaktifkan anak-anak kategori ini terlebih dahulu."
                    : undefined
                }
                onClick={() => void handleToggle(category)}
              >
                {category.isActive ? "Nonaktifkan" : "Aktifkan"}
              </Button>
            </div>
          </TableCell>
        ) : null}
      </TableRow>
    )
  }

  const rows: ReactNode[] = []
  for (const category of categories) {
    rows.push(renderRow(category, 0))
    for (const child of category.children) rows.push(renderRow(child, 1))
  }

  return (
    <div className="space-y-3">
      {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama</TableHead>
            <TableHead>Jenis</TableHead>
            <TableHead>Kalibrasi</TableHead>
            <TableHead>Aset</TableHead>
            {canManage ? <TableHead>Aksi</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>{rows}</TableBody>
      </Table>
    </div>
  )
}

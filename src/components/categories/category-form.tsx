"use client"

import { useActionState, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createCategoryAction, updateCategoryAction } from "@/server/actions/category.actions"
import type { CategoryView } from "./category-table"

type CategoryFormDialogProps = {
  mode: "create" | "edit"
  category?: CategoryView
  topLevel: CategoryView[]
}

export function CategoryFormDialog({ mode, category, topLevel }: CategoryFormDialogProps) {
  const categoryId = category?.id ?? ""
  const [state, formAction, isPending] = useActionState(
    mode === "edit" ? updateCategoryAction.bind(null, categoryId) : createCategoryAction,
    null,
  )
  const [open, setOpen] = useState(false)
  const [isMedicalDevice, setIsMedicalDevice] = useState(category?.isMedicalDevice ?? false)

  const parentCandidates = topLevel.filter((c) => c.id !== category?.id)

  useEffect(() => {
    if (state?.ok) {
      setOpen(false)
    }
  }, [state])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant={mode === "create" ? "default" : "outline"} size="sm">
            {mode === "create" ? "Tambah Kategori" : "Ubah"}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Tambah Kategori" : "Ubah Kategori"}</DialogTitle>
          <DialogDescription>
            Kategori bersusun dua tingkat. Kategori alat medis memiliki interval kalibrasi
            bawaan.yang
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="category-name">Nama *</Label>
            <Input id="category-name" name="name" defaultValue={category?.name} required />
          </div>

          <div className="space-y-1">
            <Label htmlFor="category-code">Kode</Label>
            <Input
              id="category-code"
              name="code"
              defaultValue={category?.code ?? ""}
              placeholder="Misal. EM, FUR"
              maxLength={20}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="category-parent">Induk</Label>
            <Select name="parentId" defaultValue={category?.parentId ?? ""}>
              <SelectTrigger id="category-parent" className="w-full">
                <SelectValue placeholder="— Tanpa induk —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">— Tanpa induk —</SelectItem>
                {parentCandidates.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isMedicalDevice"
              checked={isMedicalDevice}
              onChange={(e) => setIsMedicalDevice(e.target.checked)}
              className="size-4 rounded border-border accent-foreground"
            />
            Alat medis{isMedicalDevice ? " (wajib kalibrasi)" : ""}
          </label>

          {isMedicalDevice ? (
            <div className="space-y-1">
              <Label htmlFor="category-interval">Interval kalibrasi bawaan (bulan) *</Label>
              <Input
                id="category-interval"
                name="defaultCalibrationIntervalMonths"
                type="number"
                min={1}
                max={120}
                defaultValue={category?.defaultCalibrationIntervalMonths ?? 12}
                required
              />
            </div>
          ) : null}

          {state?.ok === false ? <p className="text-sm text-destructive">{state.error}</p> : null}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useRouter } from "next/navigation"
import { useActionState, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createAssetAction } from "@/server/actions/asset.actions"

type Option = { id: string; label: string }

const CONDITIONS: Array<{ value: string; label: string }> = [
  { value: "GOOD", label: "Baik" },
  { value: "MINOR_ISSUE", label: "Ada catatan kecil" },
  { value: "NEEDS_REPAIR", label: "Perlu diperbaiki" },
  { value: "UNUSABLE", label: "Tidak dapat dipakai" },
]

const FUNDING_SOURCES: Array<{ value: string; label: string }> = [
  { value: "", label: "— Tidak diisi —" },
  { value: "APBD", label: "APBD" },
  { value: "APBN", label: "APBN" },
  { value: "BLUD", label: "BLUD" },
  { value: "HIBAH", label: "Hibah" },
  { value: "KSO", label: "KSO" },
  { value: "LAINNYA", label: "Lainnya" },
]

export function AssetForm({ categories, rooms }: { categories: Option[]; rooms: Option[] }) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(createAssetAction, null)
  const [confirmDuplicate, setConfirmDuplicate] = useState(false)

  useEffect(() => {
    if (state?.ok) {
      router.push(`/assets/${state.assetId}?created=1`)
    }
  }, [state, router])

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <section className="space-y-4 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Data pokok</h2>

        <div className="space-y-1">
          <Label htmlFor="name">Nama aset *</Label>
          <Input id="name" name="name" required maxLength={200} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="categoryId">Kategori *</Label>
            <Select
              name="categoryId"
              required
              items={Object.fromEntries(categories.map((c) => [c.id, c.label]))}
            >
              <SelectTrigger id="categoryId" className="w-full">
                <SelectValue placeholder="Pilih kategori" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="locationId">Ruangan *</Label>
            <Select
              name="locationId"
              required
              items={Object.fromEntries(rooms.map((r) => [r.id, r.label]))}
            >
              <SelectTrigger id="locationId" className="w-full">
                <SelectValue placeholder="Pilih ruangan" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="condition">Kondisi awal *</Label>
            <Select
              name="condition"
              defaultValue="GOOD"
              required
              items={Object.fromEntries(CONDITIONS.map((c) => [c.value, c.label]))}
            >
              <SelectTrigger id="condition" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONDITIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="acquisitionDate">Tanggal perolehan *</Label>
            <Input id="acquisitionDate" name="acquisitionDate" type="date" required />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Detail (opsional)</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="brand">Merek</Label>
            <Input id="brand" name="brand" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="model">Model</Label>
            <Input id="model" name="model" />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="serialNumber">Nomor seri</Label>
          <Input id="serialNumber" name="serialNumber" />
        </div>

        {state?.ok === false && state.duplicateSerial ? (
          <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            <p>{state.error}</p>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="confirmDuplicateSerial"
                checked={confirmDuplicate}
                onChange={(e) => setConfirmDuplicate(e.target.checked)}
                className="size-4"
              />
              Lanjutkan tetap simpan aset ini
            </label>
          </div>
        ) : (
          <input type="hidden" name="confirmDuplicateSerial" value={confirmDuplicate ? "on" : ""} />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="yearManufactured">Tahun pembuatan</Label>
            <Input
              id="yearManufactured"
              name="yearManufactured"
              type="number"
              min={1900}
              max={2100}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fundingSource">Sumber dana</Label>
            <Select
              name="fundingSource"
              defaultValue=""
              items={Object.fromEntries(FUNDING_SOURCES.map((f) => [f.value, f.label]))}
            >
              <SelectTrigger id="fundingSource" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FUNDING_SOURCES.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="acquisitionCost">Nilai perolehan (Rp)</Label>
            <Input id="acquisitionCost" name="acquisitionCost" type="number" min={0} step="0.01" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="acquisitionDocumentNo">Nomor dokumen perolehan</Label>
            <Input id="acquisitionDocumentNo" name="acquisitionDocumentNo" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="warrantyUntil">Garansi berakhir</Label>
            <Input id="warrantyUntil" name="warrantyUntil" type="date" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="economicLifeYears">Umur ekonomis (tahun)</Label>
            <Input
              id="economicLifeYears"
              name="economicLifeYears"
              type="number"
              min={1}
              max={100}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="notes">Catatan</Label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            maxLength={2000}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </section>

      {state?.ok === false && !state.duplicateSerial ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Menyimpan…" : "Daftarkan Aset"}
      </Button>
    </form>
  )
}

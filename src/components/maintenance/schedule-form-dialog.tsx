"use client"

import { useActionState, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
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
import { createScheduleAction } from "@/server/actions/maintenance.actions"

const TYPES = [
  { value: "CALIBRATION", label: "Kalibrasi" },
  { value: "PREVENTIVE", label: "Pemeliharaan preventif" },
  { value: "CORRECTIVE", label: "Perbaikan korektif" },
]

/** FR-21: jadwal kalibrasi/pemeliharaan preventif untuk satu aset. */
export function ScheduleFormDialog({ assetId }: { assetId: string }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(createScheduleAction, null)

  useEffect(() => {
    if (state?.ok) setOpen(false)
  }, [state])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Tambah Jadwal</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah jadwal pemeliharaan</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="assetId" value={assetId} />

          <div className="space-y-1">
            <Label htmlFor="scheduleType">Jenis *</Label>
            <Select
              name="type"
              defaultValue="PREVENTIVE"
              items={Object.fromEntries(TYPES.map((t) => [t.value, t.label]))}
            >
              <SelectTrigger id="scheduleType" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="intervalMonths">Interval (bulan) *</Label>
              <Input
                id="intervalMonths"
                name="intervalMonths"
                type="number"
                min={1}
                max={120}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nextDueAt">Jatuh tempo pertama *</Label>
              <Input id="nextDueAt" name="nextDueAt" type="date" required />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="scheduleNotes">Catatan</Label>
            <textarea
              id="scheduleNotes"
              name="notes"
              rows={2}
              maxLength={1000}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-base"
            />
          </div>

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

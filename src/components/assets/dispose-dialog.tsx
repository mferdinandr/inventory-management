"use client"

import { useRouter } from "next/navigation"
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
import { disposeAssetAction } from "@/server/actions/event.actions"

const REASONS = [
  { value: "RUSAK_TOTAL", label: "Rusak total" },
  { value: "HILANG", label: "Hilang" },
  { value: "DIHIBAHKAN", label: "Dihibahkan" },
  { value: "DIJUAL", label: "Dijual" },
  { value: "KEDALUWARSA", label: "Kedaluwarsa" },
  { value: "LAINNYA", label: "Lainnya" },
]

function nowLocalDateTimeValue(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

/** FR-11: penghapusan aset — dapat dibatalkan 30 hari, tidak pernah dihapus permanen. */
export function DisposeDialog({ assetId }: { assetId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(disposeAssetAction, null)

  useEffect(() => {
    if (state?.ok) {
      setOpen(false)
      router.refresh()
    }
  }, [state, router])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" />}>Hapuskan Aset</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hapuskan aset</DialogTitle>
          <DialogDescription>
            Aset akan berstatus "Dihapuskan" dan hilang dari daftar dan pencarian. Anda dapat
            membatalkannya dalam 30 hari dari halaman "Aset Dihapuskan".
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-3">
          <input type="hidden" name="assetId" value={assetId} />

          <div className="space-y-1">
            <Label htmlFor="disposeReason">Alasan *</Label>
            <Select
              name="reason"
              required
              items={Object.fromEntries(REASONS.map((r) => [r.value, r.label]))}
            >
              <SelectTrigger id="disposeReason" className="w-full">
                <SelectValue placeholder="Pilih alasan" />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="disposeOccurredAt">Tanggal *</Label>
            <Input
              id="disposeOccurredAt"
              name="occurredAt"
              type="datetime-local"
              defaultValue={nowLocalDateTimeValue()}
              max={nowLocalDateTimeValue()}
              required
            />
          </div>

          {state?.ok === false ? <p className="text-sm text-destructive">{state.error}</p> : null}

          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? "Memproses…" : "Hapuskan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

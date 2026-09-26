"use client"

import { useRouter } from "next/navigation"
import { useActionState, useEffect } from "react"
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
import { transferAssetAction } from "@/server/actions/event.actions"

type Option = { id: string; label: string }

function nowLocalDateTimeValue(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

/** FR-10: mutasi/transfer ruangan — PIC aset otomatis ikut PIC ruangan tujuan. */
export function TransferForm({ assetId, rooms }: { assetId: string; rooms: Option[] }) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(transferAssetAction, null)

  useEffect(() => {
    if (state?.ok) router.refresh()
  }, [state, router])

  return (
    <form action={formAction} className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="text-sm font-semibold">Mutasi / pindah ruangan</h2>
      <input type="hidden" name="assetId" value={assetId} />

      <div className="space-y-1">
        <Label htmlFor="toLocationId">Ruangan tujuan *</Label>
        <Select
          name="toLocationId"
          required
          items={Object.fromEntries(rooms.map((r) => [r.id, r.label]))}
        >
          <SelectTrigger id="toLocationId" className="w-full">
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

      <div className="space-y-1">
        <Label htmlFor="transferOccurredAt">Waktu kejadian *</Label>
        <Input
          id="transferOccurredAt"
          name="occurredAt"
          type="datetime-local"
          defaultValue={nowLocalDateTimeValue()}
          max={nowLocalDateTimeValue()}
          required
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="transferReason">Alasan *</Label>
        <textarea
          id="transferReason"
          name="reason"
          rows={2}
          required
          maxLength={500}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      {state?.ok === false ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? "Memproses…" : "Pindahkan Aset"}
      </Button>
    </form>
  )
}

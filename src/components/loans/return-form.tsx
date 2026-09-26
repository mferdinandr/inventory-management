"use client"

import { useRouter } from "next/navigation"
import { useActionState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { returnLoanAction } from "@/server/actions/loan.actions"

const CONDITIONS = [
  { value: "GOOD", label: "Baik" },
  { value: "MINOR_ISSUE", label: "Ada catatan kecil" },
  { value: "NEEDS_REPAIR", label: "Perlu diperbaiki" },
  { value: "UNUSABLE", label: "Tidak dapat dipakai" },
]

/** FR-19: kondisi rusak/tidak dapat dipakai mengembalikan aset ke status DAMAGED, bukan AVAILABLE. */
export function ReturnForm({ loanId, assetId }: { loanId: string; assetId: string }) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(returnLoanAction, null)

  useEffect(() => {
    if (state?.ok) router.refresh()
  }, [state, router])

  return (
    <form action={formAction} className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="text-sm font-semibold">Catat pengembalian</h2>
      <input type="hidden" name="loanId" value={loanId} />
      <input type="hidden" name="assetId" value={assetId} />

      <div className="space-y-1">
        <Label htmlFor="conditionIn">Kondisi saat kembali *</Label>
        <Select
          name="conditionIn"
          defaultValue="GOOD"
          items={Object.fromEntries(CONDITIONS.map((c) => [c.value, c.label]))}
        >
          <SelectTrigger id="conditionIn" className="w-full">
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
        <Label htmlFor="returnNotes">Catatan</Label>
        <textarea
          id="returnNotes"
          name="returnNotes"
          rows={2}
          maxLength={2000}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      {state?.ok === false ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? "Memproses…" : "Kembalikan"}
      </Button>
    </form>
  )
}

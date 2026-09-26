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
import { checkoutLoanAction } from "@/server/actions/loan.actions"

type Option = { id: string; label: string }

const CONDITIONS = [
  { value: "GOOD", label: "Baik" },
  { value: "MINOR_ISSUE", label: "Ada catatan kecil" },
  { value: "NEEDS_REPAIR", label: "Perlu diperbaiki" },
  { value: "UNUSABLE", label: "Tidak dapat dipakai" },
]

/** FR-18: peminjaman langsung aktif, tanpa persetujuan — peminjam terdaftar atau orang luar. */
export function CheckoutForm({ assetId, users }: { assetId: string; users: Option[] }) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(checkoutLoanAction, null)
  const [borrowerType, setBorrowerType] = useState<"INTERNAL_USER" | "EXTERNAL_PERSON">(
    "INTERNAL_USER",
  )

  useEffect(() => {
    if (state?.ok) router.refresh()
  }, [state, router])

  return (
    <form action={formAction} className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="text-sm font-semibold">Pinjamkan aset</h2>
      <input type="hidden" name="assetId" value={assetId} />

      <div className="space-y-1">
        <Label htmlFor="borrowerType">Peminjam *</Label>
        <Select
          name="borrowerType"
          value={borrowerType}
          onValueChange={(v) => setBorrowerType(v as typeof borrowerType)}
          items={{ INTERNAL_USER: "Pengguna terdaftar", EXTERNAL_PERSON: "Orang luar" }}
        >
          <SelectTrigger id="borrowerType" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="INTERNAL_USER">Pengguna terdaftar</SelectItem>
            <SelectItem value="EXTERNAL_PERSON">Orang luar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {borrowerType === "INTERNAL_USER" ? (
        <div className="space-y-1">
          <Label htmlFor="borrowerUserId">Pilih pengguna *</Label>
          <Select
            name="borrowerUserId"
            items={Object.fromEntries(users.map((u) => [u.id, u.label]))}
          >
            <SelectTrigger id="borrowerUserId" className="w-full">
              <SelectValue placeholder="Pilih pengguna" />
            </SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="borrowerName">Nama *</Label>
            <Input id="borrowerName" name="borrowerName" maxLength={150} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="borrowerPhone">Nomor HP *</Label>
            <Input id="borrowerPhone" name="borrowerPhone" maxLength={30} />
          </div>
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor="borrowerUnit">Unit/ruangan asal (opsional)</Label>
        <Input id="borrowerUnit" name="borrowerUnit" maxLength={150} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="purpose">Keperluan *</Label>
        <Input id="purpose" name="purpose" required maxLength={500} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="dueAt">Jatuh tempo (opsional)</Label>
          <Input id="dueAt" name="dueAt" type="datetime-local" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="conditionOut">Kondisi saat dipinjam *</Label>
          <Select
            name="conditionOut"
            defaultValue="GOOD"
            items={Object.fromEntries(CONDITIONS.map((c) => [c.value, c.label]))}
          >
            <SelectTrigger id="conditionOut" className="w-full">
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
      </div>

      {state?.ok === false ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Menyimpan…" : "Pinjamkan"}
      </Button>
    </form>
  )
}

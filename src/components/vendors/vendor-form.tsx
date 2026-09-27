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
import { createVendorAction, updateVendorAction } from "@/server/actions/vendor.actions"
import type { VendorView } from "./vendor-table"

const TYPES: Array<{ value: string; label: string }> = [
  { value: "SUPPLIER", label: "Pemasok barang" },
  { value: "SERVICE", label: "Servis / perbaikan" },
  { value: "CALIBRATION", label: "Kalibrasi" },
]

export function VendorFormDialog({
  mode,
  vendor,
}: {
  mode: "create" | "edit"
  vendor?: VendorView
}) {
  const vendorId = vendor?.id ?? ""
  const [state, formAction, isPending] = useActionState(
    mode === "edit" ? updateVendorAction.bind(null, vendorId) : createVendorAction,
    null,
  )
  const [open, setOpen] = useState(false)
  const [types, setTypes] = useState<string[]>(vendor?.type ?? [])

  useEffect(() => {
    if (state?.ok) setOpen(false)
  }, [state])

  function toggleType(value: string) {
    setTypes((prev) => (prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant={mode === "edit" ? "outline" : "default"}
            size={mode === "edit" ? "sm" : "default"}
          />
        }
      >
        {mode === "edit" ? "Ubah" : "Tambah Vendor"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Ubah vendor" : "Tambah vendor"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="vendorName">Nama *</Label>
            <Input
              id="vendorName"
              name="name"
              required
              maxLength={200}
              defaultValue={vendor?.name}
            />
          </div>

          <fieldset className="space-y-1">
            <legend className="text-base font-medium">Jenis *</legend>
            <div className="flex flex-col gap-2">
              {TYPES.map((t) => (
                <label key={t.value} className="flex items-center gap-2 text-base">
                  <input
                    type="checkbox"
                    name="type"
                    value={t.value}
                    checked={types.includes(t.value)}
                    onChange={() => toggleType(t.value)}
                    className="size-4"
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-1">
            <Label htmlFor="vendorContactPerson">Kontak person</Label>
            <Input
              id="vendorContactPerson"
              name="contactPerson"
              maxLength={150}
              defaultValue={vendor?.contactPerson ?? ""}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="vendorPhone">Telepon</Label>
              <Input
                id="vendorPhone"
                name="phone"
                maxLength={30}
                defaultValue={vendor?.phone ?? ""}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="vendorEmail">Email</Label>
              <Input
                id="vendorEmail"
                name="email"
                type="email"
                maxLength={200}
                defaultValue={vendor?.email ?? ""}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="vendorAddress">Alamat</Label>
            <textarea
              id="vendorAddress"
              name="address"
              rows={2}
              maxLength={500}
              defaultValue={vendor?.address ?? ""}
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

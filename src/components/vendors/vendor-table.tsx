"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
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
import { setVendorActiveAction } from "@/server/actions/vendor.actions"
import { VendorFormDialog } from "./vendor-form"

export type VendorView = {
  id: string
  name: string
  type: string[]
  contactPerson: string | null
  phone: string | null
  email: string | null
  address: string | null
  isActive: boolean
}

const TYPE_LABELS: Record<string, string> = {
  SUPPLIER: "Pemasok",
  SERVICE: "Servis",
  CALIBRATION: "Kalibrasi",
}

export function VendorTable({ vendors, canManage }: { vendors: VendorView[]; canManage: boolean }) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleToggle(vendor: VendorView) {
    setActionError(null)
    setPendingId(vendor.id)
    const res = await setVendorActiveAction(vendor.id, !vendor.isActive)
    setPendingId(null)
    if (!res.ok) {
      setActionError(res.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama</TableHead>
            <TableHead>Jenis</TableHead>
            <TableHead>Kontak</TableHead>
            {canManage ? <TableHead>Aksi</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {vendors.map((vendor) => (
            <TableRow key={vendor.id} className={!vendor.isActive ? "opacity-55" : undefined}>
              <TableCell>
                <div className="flex items-center gap-2 font-medium">
                  <span>{vendor.name}</span>
                  {!vendor.isActive ? <Badge variant="outline">Nonaktif</Badge> : null}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {vendor.type.map((t) => (
                    <Badge key={t} variant="secondary">
                      {TYPE_LABELS[t] ?? t}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {vendor.contactPerson ?? "—"}
                {vendor.phone ? ` · ${vendor.phone}` : ""}
              </TableCell>
              {canManage ? (
                <TableCell>
                  <div className="flex items-center gap-1">
                    <VendorFormDialog mode="edit" vendor={vendor} />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pendingId === vendor.id}
                      onClick={() => void handleToggle(vendor)}
                    >
                      {vendor.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                  </div>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

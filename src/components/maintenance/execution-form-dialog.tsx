"use client"

import { useRouter } from "next/navigation"
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
import {
  recordExecutionAction,
  requestCertificateUploadAction,
} from "@/server/actions/maintenance.actions"

type Option = { id: string; label: string }

const RESULTS = [
  { value: "PASS", label: "Lulus" },
  { value: "PASS_WITH_NOTE", label: "Lulus bersyarat" },
  { value: "FAIL", label: "Tidak lulus" },
]

/** FR-22: mencatat pelaksanaan kalibrasi/pemeliharaan, dengan sertifikat opsional. */
export function ExecutionFormDialog({
  assetId,
  scheduleId,
  vendors,
}: {
  assetId: string
  scheduleId: string
  vendors: Option[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(recordExecutionAction, null)
  const [performedBy, setPerformedBy] = useState<"VENDOR" | "INTERNAL">("INTERNAL")
  const [certificateObjectKey, setCertificateObjectKey] = useState("")
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (state?.ok) {
      setOpen(false)
      if (state.result === "FAIL") {
        window.alert(
          "Hasil tidak lulus: aset ini otomatis berstatus Rusak dan tidak boleh dipakai.",
        )
      }
      router.refresh()
    }
  }, [state, router])

  // Diunggah segera saat berkas dipilih (bukan saat submit) — bentuk hidden
  // input certificateObjectKey sudah terisi sebelum form pernah dikirim,
  // jadi submit selalu jalur tunggal yang sama tanpa perlu intersepsi/mengirim ulang.
  async function handleFileChange(file: File | null) {
    if (!file) {
      setCertificateObjectKey("")
      setUploadStatus(null)
      return
    }
    setUploading(true)
    setUploadStatus("Mengunggah sertifikat…")

    const requested = await requestCertificateUploadAction({
      assetId,
      scheduleId,
      contentType: file.type,
      sizeBytes: file.size,
    })
    if (!requested.ok) {
      setUploadStatus(requested.error)
      setUploading(false)
      return
    }

    const putRes = await fetch(requested.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    })
    if (!putRes.ok) {
      setUploadStatus(`Unggah sertifikat gagal (${putRes.status}).`)
      setUploading(false)
      return
    }

    setCertificateObjectKey(requested.objectKey)
    setUploading(false)
    setUploadStatus("Sertifikat siap diunggah bersama entri ini.")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Catat Pelaksanaan
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Catat pelaksanaan</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="assetId" value={assetId} />
          <input type="hidden" name="scheduleId" value={scheduleId} />
          <input type="hidden" name="certificateObjectKey" value={certificateObjectKey} />

          <div className="space-y-1">
            <Label htmlFor="performedAt">Tanggal pelaksanaan *</Label>
            <Input id="performedAt" name="performedAt" type="date" required />
          </div>

          <div className="space-y-1">
            <Label htmlFor="performedBy">Pelaksana *</Label>
            <Select
              name="performedBy"
              value={performedBy}
              onValueChange={(v) => setPerformedBy(v as typeof performedBy)}
              items={{ INTERNAL: "Internal", VENDOR: "Vendor" }}
            >
              <SelectTrigger id="performedBy" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INTERNAL">Internal</SelectItem>
                <SelectItem value="VENDOR">Vendor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {performedBy === "VENDOR" ? (
            <div className="space-y-1">
              <Label htmlFor="performedByVendorId">Vendor *</Label>
              <Select
                name="performedByVendorId"
                items={Object.fromEntries(vendors.map((v) => [v.id, v.label]))}
              >
                <SelectTrigger id="performedByVendorId" className="w-full">
                  <SelectValue placeholder="Pilih vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1">
              <Label htmlFor="performedByInternal">Nama pelaksana *</Label>
              <Input id="performedByInternal" name="performedByInternal" maxLength={150} />
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="result">Hasil *</Label>
            <Select
              name="result"
              defaultValue="PASS"
              items={Object.fromEntries(RESULTS.map((r) => [r.value, r.label]))}
            >
              <SelectTrigger id="result" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESULTS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="validUntil">Berlaku sampai (opsional)</Label>
              <Input id="validUntil" name="validUntil" type="date" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="certificateNumber">Nomor sertifikat</Label>
              <Input id="certificateNumber" name="certificateNumber" maxLength={100} />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="certificateFile">Berkas sertifikat (opsional)</Label>
            <input
              id="certificateFile"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              disabled={uploading}
              onChange={(e) => void handleFileChange(e.target.files?.[0] ?? null)}
              className="block w-full text-sm"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="cost">Biaya (Rp)</Label>
              <Input id="cost" name="cost" type="number" min={0} step="0.01" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="partsReplaced">Suku cadang diganti</Label>
              <Input id="partsReplaced" name="partsReplaced" maxLength={500} />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="description">Catatan</Label>
            <textarea
              id="description"
              name="description"
              rows={2}
              maxLength={2000}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-base"
            />
          </div>

          {state?.ok === false ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {uploadStatus ? <p className="text-sm text-muted-foreground">{uploadStatus}</p> : null}

          <DialogFooter>
            <Button type="submit" disabled={isPending || uploading}>
              {uploading ? "Mengunggah…" : isPending ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

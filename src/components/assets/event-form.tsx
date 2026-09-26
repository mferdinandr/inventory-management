"use client"

import { useRouter } from "next/navigation"
import { useActionState, useEffect, useRef, useState } from "react"
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
import { uploadAttachmentsForEvent } from "@/lib/upload-attachments.client"
import { recordHistoryEventAction } from "@/server/actions/event.actions"

const EVENT_TYPES = [
  { value: "NOTE", label: "Catatan" },
  { value: "INSPECTION", label: "Inspeksi" },
  { value: "MAINTENANCE", label: "Pemeliharaan" },
  { value: "REPAIR", label: "Perbaikan" },
  { value: "CALIBRATION", label: "Kalibrasi" },
  { value: "STATUS_CHANGE", label: "Ubah status" },
]

const STATUSES = [
  { value: "AVAILABLE", label: "Tersedia" },
  { value: "IN_USE", label: "Sedang dipakai" },
  { value: "UNDER_REPAIR", label: "Dalam perbaikan" },
  { value: "AT_VENDOR", label: "Di vendor" },
  { value: "DAMAGED", label: "Rusak" },
  { value: "LOST", label: "Hilang" },
]

function nowLocalDateTimeValue(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export function EventForm({ assetId }: { assetId: string }) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(recordHistoryEventAction, null)
  const [type, setType] = useState("NOTE")
  const [files, setFiles] = useState<File[]>([])
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const handledEventId = useRef<string | null>(null)

  useEffect(() => {
    if (!state?.ok) return
    const { eventId } = state
    if (handledEventId.current === eventId) return
    handledEventId.current = eventId

    async function finish() {
      if (files.length > 0) {
        setUploadStatus(`Mengunggah ${files.length} lampiran…`)
        const result = await uploadAttachmentsForEvent(eventId, files)
        if (result.errors.length > 0) {
          setUploadStatus(`Sebagian lampiran gagal diunggah: ${result.errors.join("; ")}`)
          return
        }
      }
      router.refresh()
      setFiles([])
      if (fileInputRef.current) fileInputRef.current.value = ""
      setUploadStatus(null)
    }
    void finish()
  }, [state, files, router])

  return (
    <form action={formAction} className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="text-sm font-semibold">Catat riwayat</h2>
      <input type="hidden" name="assetId" value={assetId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="type">Jenis *</Label>
          <Select
            name="type"
            value={type}
            onValueChange={(v) => setType(v as string)}
            items={Object.fromEntries(EVENT_TYPES.map((t) => [t.value, t.label]))}
          >
            <SelectTrigger id="type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {type === "STATUS_CHANGE" ? (
          <div className="space-y-1">
            <Label htmlFor="newStatus">Status baru *</Label>
            <Select
              name="newStatus"
              items={Object.fromEntries(STATUSES.map((s) => [s.value, s.label]))}
            >
              <SelectTrigger id="newStatus" className="w-full">
                <SelectValue placeholder="Pilih status" />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-1">
            <Label htmlFor="occurredAt-alt">Waktu kejadian *</Label>
            <Input
              id="occurredAt-alt"
              name="occurredAt"
              type="datetime-local"
              defaultValue={nowLocalDateTimeValue()}
              max={nowLocalDateTimeValue()}
              required
            />
          </div>
        )}
      </div>

      {type === "STATUS_CHANGE" ? (
        <div className="space-y-1">
          <Label htmlFor="occurredAt">Waktu kejadian *</Label>
          <Input
            id="occurredAt"
            name="occurredAt"
            type="datetime-local"
            defaultValue={nowLocalDateTimeValue()}
            max={nowLocalDateTimeValue()}
            required
          />
        </div>
      ) : null}

      <div className="space-y-1">
        <Label htmlFor="title">Judul *</Label>
        <Input id="title" name="title" required maxLength={200} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="notes">Catatan</Label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={4000}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="attachments">Foto (opsional, maks. 5)</Label>
        <input
          ref={fileInputRef}
          id="attachments"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))}
          className="block w-full text-sm"
        />
        {files.length > 0 ? (
          <p className="text-xs text-muted-foreground">{files.length} berkas dipilih.</p>
        ) : null}
      </div>

      {state?.ok === false ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {uploadStatus ? <p className="text-sm text-muted-foreground">{uploadStatus}</p> : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Menyimpan…" : "Simpan"}
      </Button>
    </form>
  )
}
